import { Component, OnInit, inject } from "@angular/core";
import { BehaviorSubject, Observable, ReplaySubject, Subject } from "rxjs";
import * as ops from "rxjs/operators";

import { faInternetExplorer } from "@fortawesome/free-brands-svg-icons";
import {
  faHammer,
  faSpinner,
  faSquareUpRight,
} from "@fortawesome/free-solid-svg-icons";
import { ToastrService } from "ngx-toastr";
import { User } from "src/app/core/services";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";
import { FieldType } from "src/lib/flow/input/input.component";
import { LinkColour } from "src/lib/flow/link/link.directive";

@Component({
  selector: "app-testbed",
  templateUrl: "./testbed.component.html",
  standalone: false,
})
export class TestbedComponent implements OnInit {
  user = inject(User);
  toastrService = inject(ToastrService);

  protected faInternetExplorer = faInternetExplorer;
  protected faHammer = faHammer;
  protected faSquareUpRight = faSquareUpRight;
  protected faSpinner = faSpinner;

  false$ = new BehaviorSubject(false);
  true$ = new BehaviorSubject(true);
  unknown$ = new Subject();

  error$: Observable<number>;

  data: (string | number)[] = ["", "", 5, "2023-07-07T17:32:00"];
  checkboxValue = false;
  checkbox2Value = true;
  dropdownValue = "soup";
  toggleValue = false;

  readonly ButtonType = ButtonType;
  readonly ButtonSize = ButtonSize;
  readonly LinkColour = LinkColour;

  protected InputFieldTypes: FieldType[] = [
    "text",
    "email",
    "number",
    "datetime-local",
  ];

  dialogTypes = {
    success: () => this.toastrService.success("Success!", "Title"),
    info: () => this.toastrService.info("Info!", "Title"),
    warning: () => this.toastrService.warning("Warning!", "Title"),
    error: () => this.toastrService.error("Error!", "Title"),
    copy: () => this.toastrService.show("Copy!", "Title", {}, "copy"),
  };

  cuteAnimals = [
    {
      name: "Charlie",
      type: "Dog",
    },
    {
      name: "Mr Hungry",
      type: "Cat",
    },
    {
      name: "Rudolph",
      type: "Reindeer",
    },
  ];

  ngOnInit(): void {
    const tmp = new ReplaySubject<number>(1);
    this.error$ = tmp.pipe(
      // We want to throw an error in the pipeline
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ops.map((d) => d as any),
      ops.map((d) => d.a.b),
      ops.shareReplay(1),
    );

    tmp.next(0);
  }

  clippyCount = 0;
  clippyFacts() {
    const facts = [
      "I coined the phrase 'targeted spearphishing'!",
      "APT 1 through 101 was me!",
      "I created all those files your yara rule hits on by mistake!",
      "Do you remember that time your computer was hacked?! It was me, Clippy!",
      "I designed the pdf specification!",
      "I have told you everything I know!",
      "Wait, there is one other thing!",
      "I have told you everything I know!",
    ];
    this.toastrService.show(
      facts[this.clippyCount],
      `Hi there! I'm Clippy!`,
      {},
      "copy",
    );
    this.clippyCount += 1;
    this.clippyCount = Math.min(this.clippyCount, facts.length - 1);
  }
}
