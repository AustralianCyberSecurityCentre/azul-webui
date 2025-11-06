import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  QueryList,
  ViewChildren,
} from "@angular/core";
import { BehaviorSubject, Observable, Subscription, combineLatest } from "rxjs";
import * as ops from "rxjs/operators";

import { CommonModule } from "@angular/common";
import { StreamMetadataWithAuthor } from "src/app/common/misc-interfaces/stream-metadata";
import { BaseCard } from "src/app/entity-cards/base-card.component";
import { AzEntityCardsModule } from "src/app/entity-cards/entity-cards.module";
import {
  DataTabPanesComponent,
  TabSpec,
} from "../data-tab-panes/data-tab-panes.component";

@Component({
  selector: "azco-data-tab",
  templateUrl: "./data-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AzEntityCardsModule, CommonModule, DataTabPanesComponent],
})
export class DataTabComponent
  extends BaseCard
  implements AfterViewInit, OnDestroy
{
  // Supported in Firefox/Edge:
  // jpeg, png, gif, bmp, ico, webp
  // Not supported (needs conversion):
  // tiff
  // Future formats we may want to support rendering:
  // avif, apng
  SUPPORTED_IMAGE_TYPES = [
    "image/bmp",
    "image/gif",
    "image/jpg",
    "image/png",
    "image/icon",
    "image/webp",
  ];

  help = `
  This tab implements a view of the various data streams available for this binary.

  This can include decompiled source code, raw representations of the file or other
  large textual artefacts extracted by plugins.
  `;

  @ViewChildren("tabTemplate")
  private templates: QueryList<ElementRef<HTMLDivElement>>;

  protected contentStreams$: Observable<
    Map<string, StreamMetadataWithAuthor[]>
  >;
  protected streamsRender$: Observable<StreamMetadataWithAuthor[]>;

  protected tabs$: BehaviorSubject<TabSpec[]> = new BehaviorSubject<TabSpec[]>(
    [],
  );

  @Output()
  badgeCount = new EventEmitter<number>();
  private tabBadgeSubscription?: Subscription;
  private tabCreationSubscription?: Subscription;

  ngAfterViewInit(): void {
    this.updateTabs();
  }

  ngOnDestroy(): void {
    this.tabBadgeSubscription?.unsubscribe();
  }

  protected onEntityChange(): void {
    this.updateTabs();
  }

  /** Returns a locally unique key for the given binary stream. */
  protected getKeyForStream(stream: StreamMetadataWithAuthor): string {
    return (
      "stream-" + stream.author + stream.datastream_sha256 + stream.version
    );
  }

  /** Resolves a DOM template from the visually invisible container. */
  private resolveTemplate(name: string): ElementRef<HTMLElement> | undefined {
    for (const template of this.templates) {
      if (template.nativeElement.getAttribute("key") == name) {
        return template;
      }
    }

    return undefined;
  }

  /** Updates listeners for the entities properties. */
  private updateTabs() {
    if (!this.entity || !this.templates) {
      return;
    }

    this.contentStreams$ = combineLatest([
      this.entity.streams$,
      this.entity.instancesKv$,
    ]).pipe(
      ops.map(([streams, instances]) => {
        const renderStreams: Map<string, StreamMetadataWithAuthor[]> = new Map<
          string,
          StreamMetadataWithAuthor[]
        >();
        for (const s of streams) {
          const fileType = s.file_format_legacy.toLowerCase();

          // Filter out undesirable streams
          if (
            (fileType !== "text" &&
              this.entity.sha256.toLowerCase() === s.sha256) ||
            s.label.includes("content")
          ) {
            // We don't want to render the file itself if it isn't text
            continue;
          }

          const authorData = instances.get(s.instances[0]).author;
          const streamData = {
            author: authorData.name,
            version: authorData.version,
            category: authorData.category,
            file_format_legacy: fileType,
            file_format: s.file_format,
            label: s.label[0],
            language: s.language,
            size: s.size,
            binary_sha256: this.entity.sha256,
            datastream_sha256: s.sha256,
          };

          // Merge all user submissions to a single user called user
          if (streamData.category.toLowerCase() === "user") {
            streamData.author = streamData.category;
          }
          if (renderStreams.has(streamData.author)) {
            renderStreams.get(streamData.author).push(streamData);
          } else {
            renderStreams.set(streamData.author, [streamData]);
          }
        }
        return renderStreams;
      }),
      ops.shareReplay(),
    );

    this.streamsRender$ = this.contentStreams$.pipe(
      ops.map((map) => Array.from(map.values()).flat()),
    );

    const template$ = this.templates.changes.pipe(
      ops.startWith(this.templates),
    );

    this.tabCreationSubscription?.unsubscribe();
    this.tabCreationSubscription = combineLatest([
      this.contentStreams$,
      template$,
      this.entity.hasContent$,
    ])
      .pipe(
        ops.map(([textStreams, _templateChanges, hasContent]) => {
          // Build what tabs we have available based on the data available in the
          // environment
          const tabs: TabSpec[] = [];

          let foundViableTab = false;

          for (const authorStreams of textStreams.values()) {
            for (const stream of authorStreams) {
              // These templates might not always be instantly available
              const template = this.resolveTemplate(
                this.getKeyForStream(stream),
              );

              if (template) {
                const version = stream.version ? ` v${stream.version}` : "";
                let openInPane = undefined;
                let label = stream.label;

                // Handle special cases where we want special names for these streams
                if (
                  stream.datastream_sha256 === this.entity.sha256 &&
                  stream.file_format_legacy === "Text"
                ) {
                  // File preview of the actual file
                  openInPane = 0;
                  foundViableTab = true;
                  label = "File Preview";
                } else if (stream.label === "safe_png") {
                  openInPane = 0;
                  foundViableTab = true;
                  label = "Image Preview";
                }

                const name = `${label} (${stream.author}${version})`;
                tabs.push({
                  tabId: this.getKeyForStream(stream),
                  name: name,
                  interesting: true,
                  openInPane: openInPane,
                  template: template,
                  downloadParent: this.entity.sha256,
                  downloadHash: stream.datastream_sha256,
                });
              }
            }
          }

          if (hasContent) {
            tabs.push(
              {
                tabId: "hex",
                name: "Hex",
                openInPane: foundViableTab ? undefined : 0,
                interesting: false,
                template: this.resolveTemplate("hex")!,
              },
              {
                tabId: "strings",
                name: "Strings",
                openInPane: foundViableTab ? undefined : 1,
                interesting: false,
                template: this.resolveTemplate("strings")!,
              },
            );
          } else {
            console.warn("File has no content");
          }

          return tabs;
        }),
      )
      .subscribe((tabs) => {
        this.tabs$.next(tabs);
      });

    // Count the number of interesting tabs and emit that
    this.tabBadgeSubscription = this.tabs$
      .pipe(ops.map((tabs) => tabs.filter((tab) => tab.interesting).length))
      .subscribe((interestingCount) => {
        this.badgeCount.emit(interestingCount);
      });
  }

  /**
   * Checks a given text stream to determine if it is safe to render.
   */
  protected isTextStream(stream: StreamMetadataWithAuthor): boolean {
    // Render all code & text files
    if (
      stream.file_format?.startsWith("code/") ||
      stream.file_format?.startsWith("text/")
    ) {
      return true;
    }

    // Base case for older files
    if (stream.file_format_legacy === "text") {
      return true;
    }

    return false;
  }

  /**
   * Checks a given image stream to determine if it is safe to render.
   */
  protected isImageStream(stream: StreamMetadataWithAuthor): boolean {
    if (
      stream.file_format &&
      this.SUPPORTED_IMAGE_TYPES.includes(stream.file_format)
    ) {
      return true;
    }

    // Base case for older files
    if (
      stream.file_format_legacy === "png" ||
      stream.file_format_legacy === "jpg"
    ) {
      return true;
    }

    return false;
  }

  /**
   * Checks whether a stream is a PDF object stream.
   */
  protected isObjectStream(stream: StreamMetadataWithAuthor): boolean {
    if (
      stream.file_format === "document/pdf" ||
      stream.file_format_legacy === "pdf"
    ) {
      return true;
    }

    return false;
  }
}
