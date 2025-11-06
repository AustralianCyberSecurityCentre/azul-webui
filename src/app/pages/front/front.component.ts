import { Component, OnInit, inject } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Router } from "@angular/router";
import {
  faBook,
  faMagnifyingGlass,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";
import { Observable } from "rxjs";
import { components } from "src/app/core/api/openapi";

import { Api, User } from "src/app/core/services";
import { escapeValue } from "src/app/core/util";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

@Component({
  selector: "app-front",
  templateUrl: "./front.component.html",
  styleUrls: ["./front.component.css"],
  standalone: false,
})
export class FrontComponent implements OnInit {
  user = inject(User);
  private router = inject(Router);
  private api = inject(Api);

  protected faMagnifyingGlass = faMagnifyingGlass;
  protected ButtonType = ButtonType;
  protected ButtonSize = ButtonSize;

  protected escapeValue = escapeValue;

  protected faUpload = faUpload;
  protected faBook = faBook;

  protected term = new FormControl("");

  protected statistics$: Observable<
    components["schemas"]["StatisticSummary"] | undefined
  >;

  ngOnInit(): void {
    this.statistics$ = this.api.statisticsGet();
  }

  onSubmit() {
    this.router.navigate(["/pages/binaries/explore"], {
      queryParams: { term: this.term.value },
    });
  }
}
