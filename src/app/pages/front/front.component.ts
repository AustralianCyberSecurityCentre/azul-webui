import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  model,
} from "@angular/core";
import { Router } from "@angular/router";
import { components } from "@app/core/api/openapi";
import {
  faBook,
  faMagnifyingGlass,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";
import { Observable } from "rxjs";

import { SearchFormInterface } from "@app/common/entity-search/entity-search.component";
import { Api, User } from "@app/core/services";
import { escapeValue } from "@app/core/util";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";

@Component({
  selector: "app-front",
  templateUrl: "./front.component.html",
  styleUrls: ["./front.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  protected termModel = model<SearchFormInterface>({ term: "" });

  protected statistics$: Observable<
    components["schemas"]["StatisticSummary"] | undefined
  >;

  ngOnInit(): void {
    this.statistics$ = this.api.statisticsGet();
  }

  onSubmit() {
    this.router.navigate(["/pages/binaries/explore"], {
      queryParams: { term: this.termModel().term },
    });
  }
}
