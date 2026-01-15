/*
Known issue on highdpi monitor with chrome, node boxes are too big.
https://bugs.chromium.org/p/chromium/issues/detail?id=738022&q=foreign-object

*/

import { LabelType, Options } from "@angular-slider/ngx-slider";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  signal,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import {
  faCompress,
  faExpand,
  faEye,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { Store } from "@ngrx/store";
import * as d3 from "d3";
import * as dd3 from "dagre-d3-es";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";
import { IconService } from "src/app/core/icon.service";
import { Nav } from "src/app/core/services";
import { RelationalGraphLevel } from "src/app/core/store/global-settings/global-state.types";
import * as fromGlobalSettings from "../../core/store/global-settings/global-selector";
import { BaseCard } from "../base-card.component";

/**a single node on the graph*/
type Node = {
  id: string;
  format: string;
  opt: {
    label: string;
    labelType: string;
    rx: number;
    ry: number;
    class?: string;
  };
};

/**a single edge between two nodes on the graph*/
type Edge = {
  id: string;
  source: string;
  target: string;
  opt: {
    label: string;
    lineInterpolate: string;
    arrowhead: string;
  };
};

type Nearby = {
  edges: Edge[];
  nodes: Node[];
  graph: dd3.graphlib.Graph;
};

type RefineLink = {
  id: string;
  source: string;
  target: string;
  // event: string
  // author_type: string
  // author_name: string
  node: components["schemas"]["PathNode"];
};

type Refine = {
  node_source: {
    id: string;
    source: components["schemas"]["EventSource"];
  }[];
  node_entities: {
    id: string;
    current: boolean;
    entities: components["schemas"]["PathNode"][];
  }[];
  link: RefineLink[];
};

type Package = {
  raw: components["schemas"]["ReadNearby"];
  refine: Refine;
  render: Nearby;
};

const DEFAULT_GRAPH_STROKE_WIDTH = "4";
const DEFAULT_GRAPH_COLOR = "var(--color-sky-400)";
const HIGHLIGHT_GRAPH_STROKE_WIDTH = "8";
const HIGHTLIGHT_GRAPH_COLOR = "var(--color-amber-700)";

/**card displaying relationships between entities, centered on the current entity*/
@Component({
  selector: "azec-relation-graph",
  templateUrl: "./relation-graph.component.html",
  styleUrls: ["./relation-graph.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RelationGraphComponent extends BaseCard implements OnDestroy {
  private router = inject(Router);
  private nav = inject(Nav);
  private iconService = inject(IconService);
  private store = inject(Store);

  dbg = (...d) => console.debug("RelationGraphComponent:", ...d);
  err = (...d) => console.error("RelationGraphComponent:", ...d);

  help = `
Shows a graphical representation of relationships between entities and sources.
Click and drag to pan view.

* Orange = Source,
* Green + square edges = Current entity,
* Blue + underlined hash = Ancestor or descendants of current entity.

All graphs start with a source, which then points to entities directly inserted under that source.
All following entities are descendants of the entity above (extracted from that entity).
You can click an ancestor or descendant hash to view the binary.

If your file is extremely common or involved with a large amount of other files, some data will
not be shown on the graph.
  `;

  protected faEye = faEye;
  protected faMagnifyingGlassPlus = faMagnifyingGlassPlus;
  protected faMagnifyingGlassMinus = faMagnifyingGlassMinus;
  protected faExpand = faExpand;
  protected faCompress = faCompress;
  protected faSpinner = faSpinner;
  protected isGraphLoading: WritableSignal<boolean> = signal(true);

  // Slider settings
  protected complexitySliderValue: number = 2;
  protected complexitySliderOptions: Options = {
    stepsArray: [
      { value: 0, legend: "Basic" },
      { value: 1, legend: "Simple" },
      { value: 2, legend: "Normal" },
      { value: 3, legend: "Complex" },
    ],
    hideLimitLabels: true,
    translate: (value: number, _label: LabelType): string => {
      switch (value) {
        case 0:
          this.relationalGraphDetailSignal.set(RelationalGraphLevel.NO);
          return "Basic";
        case 1:
          this.relationalGraphDetailSignal.set(RelationalGraphLevel.YES_SMALL);
          return "Simple";
        case 2:
          this.relationalGraphDetailSignal.set(RelationalGraphLevel.YES);
          return "Normal";
        case 3:
          this.relationalGraphDetailSignal.set(RelationalGraphLevel.YES_LARGE);
          return "Complex";
        default:
          this.relationalGraphDetailSignal.set(RelationalGraphLevel.YES);
          return "Normal";
      }
    },
  };

  protected relationalGraphDetail$: Observable<RelationalGraphLevel>;
  protected relationalGraphDetailSignal: WritableSignal<RelationalGraphLevel> =
    signal(RelationalGraphLevel.YES);

  private buildNodeLink(sha256: string, current: boolean): string {
    // display half the sha256
    const shortId = sha256.slice(0, 32) + "...";
    // make a link relative to base href
    const url = this.router
      .createUrlTree(["pages", "entities", "current", "binary", sha256])
      .toString()
      .slice(1);
    let label = "";
    label += `<span class="text-sm font-bold text-white">`;
    if (!current) {
      label += `<a target="_blank" href="${url}" class="node-link">`;
      label += `${shortId}</a>`;
    } else {
      label += `${shortId}`;
    }
    label += "</span>";
    return label;
  }

  private nodeBinaryError(sha256: string): Node["opt"] {
    let label = this.buildNodeLink(sha256, false);
    label +=
      '<div class="flex gap-2 text-slate-100 text-sm pl-1">Metadata not collected</div>';
    return {
      label: `<div class="nodeLabel" style="flex-wrap: nowrap;">${label}</div>`,
      labelType: "html",
      rx: 10,
      ry: 10,
      class: "",
    };
  }

  protected override onEntityChange() {
    this.graphData$ = this.relationalGraphDetail$
      .pipe(
        ops.debounceTime(1000),
        ops.tap(() => {
          this.isGraphLoading.set(true);
        }),
        ops.switchMap((detailLevel) => {
          switch (detailLevel) {
            case RelationalGraphLevel.YES:
              return this.entity.nearby$;
            case RelationalGraphLevel.NO:
              return this.entity.nearbyNoCousins$;
            case RelationalGraphLevel.YES_SMALL:
              return this.entity.nearbySmall$;
            case RelationalGraphLevel.YES_LARGE:
              return this.entity.nearbyLarge$;
            default:
              return this.entity.nearby$;
          }
        }),
        ops.map(
          (e) =>
            <Package>{
              raw: e,
              refine: {},
              render: { edges: [], nodes: [], graph: null },
            },
        ),
        ops.tap((d) => (d.refine = this.refineData(d.raw))),
        ops.tap(
          (d) =>
            (d.render.graph = new dd3.graphlib.Graph({
              multigraph: true,
            }).setGraph({
              rankDir: "TB",
              ranksep: 80,
              nodesep: 50,
            })),
        ),
        ops.tap((d) => (d.render.edges = this.getEdges(d.refine))),
        ops.delay(10), // unfreeze
        ops.tap((d) =>
          d.render.edges.forEach((e) =>
            d.render.graph.setEdge(e.source, e.target, e.opt, e.id),
          ),
        ),
        ops.tap((d) =>
          d.render.edges.forEach((e) =>
            d.render.graph.setNode(e.source, this.nodeBinaryError(e.source)),
          ),
        ),
        ops.tap((d) =>
          d.render.edges.forEach((e) =>
            d.render.graph.setNode(e.target, this.nodeBinaryError(e.target)),
          ),
        ),
        ops.delay(10), // unfreeze
        ops.tap((d) => (d.render.nodes = this.getNodes(d.refine))),
        ops.delay(10), // unfreeze
        ops.tap((d) =>
          d.render.nodes.forEach((n) => d.render.graph.setNode(n.id, n.opt)),
        ),
        ops.delay(10), // unfreeze
        ops.shareReplay(1),
      )
      .pipe(ops.map((d) => (d as Package).render));
    this.render$ = this.graphData$.pipe(
      ops.combineLatestWith(
        this.rerender$,
        this.nav.windowSizeChange$.pipe(
          ops.startWith(null),
          ops.shareReplay(1),
        ),
      ),
      ops.debounceTime(100),
      ops.map(([a, _]) => a),
      ops.tap((a) => this.render(a.graph)),
      ops.tap(() => {
        this.isGraphLoading.set(false);
      }),
    );
    this.renderSub?.unsubscribe();
    this.renderSub = this.render$.subscribe();
  }

  @ViewChild("relationDIV", { static: false }) private div: ElementRef;
  @ViewChild("relationSVG", { static: false }) private svg: ElementRef;

  /**holds data for the graph*/
  protected graphData$: Observable<Nearby>;
  /**controls rerender signal*/
  protected rerender$ = new BehaviorSubject<null>(null);
  /**combines data and rerender to alter svg*/
  private render$: Observable<Nearby>;

  protected isFullScreen$ = new BehaviorSubject(false);

  private renderSub: Subscription;

  // controls camera for d3 svg
  private zoomer: d3.ZoomBehavior<Element, unknown>;
  constructor() {
    super();
    this.store
      .select(fromGlobalSettings.selectRelationalGraphShowCousinsByDefault)
      .pipe(ops.take(1))
      .subscribe((defaultRelational) => {
        this.relationalGraphDetailSignal.set(defaultRelational);
        switch (defaultRelational) {
          case RelationalGraphLevel.NO:
            this.complexitySliderValue = 0;
            break;
          case RelationalGraphLevel.YES_SMALL:
            this.complexitySliderValue = 1;
            break;
          case RelationalGraphLevel.YES:
            this.complexitySliderValue = 2;
            break;
          case RelationalGraphLevel.YES_LARGE:
            this.complexitySliderValue = 3;
            break;
          default:
            this.relationalGraphDetailSignal.set(RelationalGraphLevel.YES);
            this.complexitySliderValue = 2;
        }
        this.relationalGraphDetail$ = toObservable(
          this.relationalGraphDetailSignal,
        );
      });
  }

  ngOnDestroy() {
    this.renderSub?.unsubscribe();
  }

  protected zoom_out() {
    this.zoomer.scaleBy(d3.select(this.svg.nativeElement), 0.8);
  }

  protected zoom_in() {
    this.zoomer.scaleBy(d3.select(this.svg.nativeElement), 1.25);
  }

  /** Handles generic key events for when we are capturing the screen. */
  @HostListener("document:keydown.escape", ["$event"])
  protected handleKey(evt: Event) {
    const evtKeyboard = evt as KeyboardEvent;
    evtKeyboard.preventDefault();
    this.isFullScreen$.next(false);
  }

  private refineData(d: components["schemas"]["ReadNearby"]): Refine {
    // construct map of entities that have parents
    const has_children = new Set<string>();
    // Track children that have parents.
    for (const link of d.links) {
      has_children.add(link.parent);
    }

    // create list of grouped links
    const linkGroups: components["schemas"]["ReadNearbyLink"][][] = [];
    const linkMap = new Map<
      string,
      components["schemas"]["ReadNearbyLink"][]
    >();

    const linkGroupChildIdSets = new Set<string>();
    const linkMapChildIdSets = new Set<string>();

    // Add all linkgroups and merge links if they have a single common parent.
    for (const link of d.links) {
      // Dont merge anything that is a parent of something else or is a source
      // Also ensure the focus node is not grouped either.
      if (
        link.source ||
        has_children.has(link.child) ||
        link.child == d.id_focus
      ) {
        linkGroups.push([link]);
        linkGroupChildIdSets.add(link.child);
        continue;
      }
      const unique =
        link.parent +
        link.child_node.author.category +
        link.child_node.author.name +
        link.child_node.action +
        link.child_node.file_format;
      if (!linkMap.has(unique)) {
        linkMap.set(unique, []);
      }
      linkMap.get(unique).push(link);
      linkMapChildIdSets.add(link.child);
    }

    // If a child link appears in both linkMap and linkGroups it should be removed from the linkMap and put in the linkGroup
    // This prevents a child appearing multiple times on a graph (once in a group and once outside a group)
    const intersectingIds = [...linkMapChildIdSets].filter((i) =>
      linkGroupChildIdSets.has(i),
    );
    intersectingIds.forEach((childIdInBothGroupAndUnique) => {
      linkMap.forEach((val) => {
        const idx = val.findIndex(
          (v) => v.child == childIdInBothGroupAndUnique,
        );
        if (idx != -1) {
          const removed_link = val.splice(idx, 1);
          linkGroups.push(removed_link);
        }
      });
    });
    // Add all groups that have at least one element.
    linkMap.forEach((group) => {
      if (group.length > 0) {
        linkGroups.push(group);
      }
    });
    // generate nodes and edges
    const ret: Refine = {
      node_source: [],
      node_entities: [],
      link: [],
    };
    const entities = new Map<
      string,
      {
        id: string;
        current: boolean;
        entities: components["schemas"]["PathNode"][];
      }
    >();
    const sources = new Map<string, Refine["node_source"][0]>();
    for (const group of linkGroups) {
      const link = group[0];
      const targetid = link.child;
      const sourceid =
        link.parent || link.source.name + link.source.track_source_references;

      entities.set(targetid, {
        id: targetid,
        current: d.id_focus == link.child, // Verify if it is the target node.
        entities: group
          .map((x) => x.child_node)
          .sort((a, b) => (a.sha256 > b.sha256 ? 1 : -1)),
      });
      ret.link.push({
        id:
          targetid +
          sourceid +
          link.child_node.author.category +
          link.child_node.author.name +
          link.child_node.action,
        source: sourceid,
        target: targetid,
        node: link.child_node,
      });

      if (link.source) {
        sources.set(sourceid, {
          id: sourceid,
          source: link.source,
        });
      }
    }
    entities.forEach((ent) => ret.node_entities.push(ent));
    sources.forEach((source) => ret.node_source.push(source));

    ret.link.sort((a, b) => (a.id > b.id ? 1 : -1));
    ret.node_entities.sort((a, b) => (a.id > b.id ? 1 : -1));
    ret.node_source.sort((a, b) => (a.id > b.id ? 1 : -1));

    return ret;
  }

  private genContent(
    current: boolean,
    raw_datas: components["schemas"]["PathNode"][],
  ): string {
    let label = "";

    // remove duplicate ids
    const datas: components["schemas"]["PathNode"][] = [];
    let prev = "";
    for (const row of raw_datas) {
      if (row.sha256 != prev) {
        datas.push(row);
      }
      prev = row.sha256;
    }

    for (const data of datas.slice(0, 5)) {
      const iconDef = this.iconService.get("binary", data.file_format);
      const svgPathData = iconDef.icon[4];
      label += this.buildNodeLink(data.sha256, current);
      label += '<div class="flex gap-2 text-slate-100 text-sm pl-1">';
      // Manually get SVG path and size information to allow for rendering of the icon as rendering is so nested.
      const iconScaleFactor = 0.1;
      const iconHeight = iconDef.icon[0] * iconScaleFactor;
      const iconWidth = iconDef.icon[1] * iconScaleFactor;
      label += `<div class="pt-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 ${iconHeight} ${iconWidth}"
            height="${iconHeight}"
            width="${iconWidth}"
          ><g transform="scale(0.1)"><path d="${svgPathData}" fill="white"/></g></svg>
      </div>`;
      label += '<div class="mx-1">';
      const tmp = [];
      let found = 0;
      // values to display without printing the key
      // this allows for longer values to be printed in the node
      for (const key of ["file_format"]) {
        if (data[key] == undefined) {
          continue;
        }
        found += 1;
        let val = String(data[key]);
        val = val.length < 35 ? val : val.slice(0, 32) + "...";
        tmp.push(`${val}`);
      }
      // values to display with key
      for (const key of ["filename", "size", "language"]) {
        if (data[key] == undefined) {
          continue;
        }
        found += 1;
        let val = String(data[key]);
        val = val.length < 23 ? val : val.slice(0, 20) + "...";
        tmp.push(`${key}: ${val}`);
      }
      label += tmp.join("<br>");
      // If the node has little info then add a blank space.
      if (found < 3) {
        label += "<br>&nbsp;";
      }
      label += "</div>";
      label += "</div>";
    }
    if (datas.length > 5) {
      label += `+ ${datas.length - 5} others<br>`;
    }

    const content = `
    <div class="nodeLabel" style="flex-wrap: nowrap;">${label}</div>
    `;
    return content;
  }

  private genSource(data: components["schemas"]["EventSource"]): string {
    let label = ``;
    label += `<span class="text-sm font-bold text-white">`;
    label += `Source | ${data.name}`;

    label += "</span>";
    label += '<div class="text-slate-100 text-sm pl-1">';
    const tmp = [];
    tmp.push(`Timestamp: ${data.timestamp}`);
    for (const key in data.references) {
      let val = data.references[key].toString();
      if (val.length > 32) {
        val = val.slice(0, 29) + "...";
      }
      tmp.push(`${key}: ${val}`);
    }
    label += tmp.join("<br>");
    label += "</div>";
    let content = "";
    content += `
    <div class="nodeLabel" style="flex-wrap: nowrap;">${label}</div>
    `;
    return content;
  }

  private getNodes(d: Refine): Node[] {
    const nodes = [];
    for (const entity of d.node_entities) {
      nodes.push({
        id: entity.id,
        format: null,
        opt: {
          label: this.genContent(entity.current, entity.entities),
          labelType: "html",
          rx: entity.current ? 0 : 10,
          ry: entity.current ? 0 : 10,
          class: entity.current ? "current" : "",
        },
      });
    }
    for (const source of d.node_source) {
      nodes.push({
        id: source.id,
        format: null,
        opt: {
          label: this.genSource(source.source),
          labelType: "html",
          rx: 0,
          ry: 0,
          class: "source",
        },
      });
    }
    // this.dbg('nodes', nodes.length)
    return nodes;
  }

  private getEdges(d: Refine): Edge[] {
    const edges = [];
    for (const link of d.link) {
      const rAction = link.node.relationship?.action;

      let labelText = "";
      if (link.node.author.category == "user") {
        labelText += `@`;
      } else if (link.node.author.category != "plugin") {
        labelText += `${link.node.author.category} `;
      }
      labelText += `${link.node.author.name}`;

      if (rAction) {
        labelText += ` ${rAction}`;
      }
      for (const key in link.node.relationship) {
        if (key === "action") {
          continue;
        }
        let val = link.node.relationship[key].toString();
        if (val.length > 32) {
          val = val.slice(0, 29) + "...";
        }
        labelText += `\n${key}: ${val}`;
      }

      edges.push({
        id: link.id,
        source: link.source,
        target: link.target,
        opt: {
          label: labelText,
          lineInterpolate: "basis",
          arrowhead: "normal",
          curve: d3.curveBasis,
          labelpos: "c",
        },
      });
    }

    // this.dbg('edges', edges.length)
    return edges;
  }

  private render(graph: dd3.graphlib.Graph): void {
    if (!this.svg) {
      this.dbg("render data or svg is null");
      return;
    }

    const svg = d3.select(this.svg.nativeElement);
    const div = this.div.nativeElement;
    // delete any existing drawn graph
    svg.selectAll("g").remove();
    const inner = svg.append("g");
    const svgWidth = div.clientWidth;
    const svgHeight = div.clientHeight;

    // Set up zoom support
    this.zoomer = d3
      .zoom()
      .scaleExtent([0.2, 1.75])
      .on("zoom", (zoomEvent) => {
        inner.attr("transform", zoomEvent.transform);
      });

    svg.call(this.zoomer);

    // Create the renderer & run
    const render = dd3.render();
    console.time("render graph");
    render(inner, graph);
    console.timeEnd("render graph");

    // The graph should now have metadata; find the centre node
    let centreX = 0;
    let centreY = 0;

    // This relies on undocumented behaviour in dagre-d3 which mutates
    // the passed graph.
    for (const rawNode of graph.nodes()) {
      const dagreNode = graph.node(rawNode);
      if (dagreNode.class.indexOf("current") !== -1) {
        centreX = dagreNode.x;
        centreY = dagreNode.y;
      }
    }

    // Center the dag
    svg.call(
      this.zoomer.transform,
      d3.zoomIdentity.translate(
        -centreX + svgWidth / 2,
        -centreY + svgHeight / 2,
      ),
    );

    // Allow toggling of edge colour and size.
    svg.selectAll(".edgePath").on("click", function (_edgeId) {
      if (d3.select(this).style("stroke") == HIGHTLIGHT_GRAPH_COLOR) {
        d3.select(this).style("stroke-width", DEFAULT_GRAPH_STROKE_WIDTH);
        d3.select(this).style("stroke", DEFAULT_GRAPH_COLOR);
      } else {
        d3.select(this).style("stroke-width", HIGHLIGHT_GRAPH_STROKE_WIDTH);
        d3.select(this).style("stroke", HIGHTLIGHT_GRAPH_COLOR);
      }
    });
  }
}
