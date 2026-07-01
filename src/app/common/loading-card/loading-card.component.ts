import { Dialog, DialogRef } from "@angular/cdk/dialog";
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  TemplateRef,
  computed,
  inject,
  input,
} from "@angular/core";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";

import { Observable } from "rxjs";

/**In an nebular card, show a loading spinner or the required content if finished loading*/
@Component({
  selector: "az-loading-card",
  templateUrl: "./loading-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LoadingCardComponent<T> {
  private dialogService = inject(Dialog);

  dbg = (...d) => console.debug("LoadingCardComponent:", ...d);
  err = (...d) => console.error("LoadingCardComponent:", ...d);

  questionIcon = faQuestionCircle;

  /**card-header text as a title*/
  cardTitle = input<string | null>(null);
  /**show the card unless this is false*/
  @Input() set show(data: boolean) {
    this.isHidden = !data;
  }

  /**the data to tell whether things are loading still or complete or errored*/
  @Input()
  obs$: Observable<T>;

  isCheckObsIsTrue = input<boolean>(false);

  /**template output in right side of card header*/
  tplTopRight = input<TemplateRef<unknown> | undefined>(undefined);
  /**help text to display in second header*/
  help = input<string>();
  trimmedHelp = computed(() => this.help()?.trim());

  isScrollable = input<boolean>(false);

  /**hide card when necessary*/
  @HostBinding("hidden") isHidden = false;

  get showHelp(): boolean {
    return !!this.trimmedHelp() && this.trimmedHelp().length > 0;
  }

  private helpDialog?: DialogRef<unknown>;

  protected openDialog(ref: TemplateRef<unknown>) {
    this.helpDialog = this.dialogService.open(ref);
  }

  protected closeDialog() {
    this.helpDialog?.close();
  }
}
