import { Dialog, DialogRef } from "@angular/cdk/dialog";
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  TemplateRef,
  inject,
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
  @Input() cardTitle: string = null;
  /**show the card unless this is false*/
  @Input() set show(data: boolean) {
    this.isHidden = !data;
  }

  @Input() contentClass: string = "";

  /**the data to tell whether things are loading still or complete or errored*/
  @Input()
  obs$: Observable<T>;

  @Input()
  isCheckObsIsTrue: boolean;

  /**template output in right side of card header*/
  @Input() tplTopRight: TemplateRef<unknown>;
  /**help text to display in second header*/
  _help: string;
  get help() {
    return this._help;
  }
  @Input() set help(d: string) {
    this._help = d.trim();
  }

  /**hide card when necessary*/
  @HostBinding("hidden") isHidden = false;

  get showHelp(): boolean {
    return !!this._help && this._help.trim().length > 0;
  }

  _isScrollable: boolean;
  get isScrollable() {
    return this._isScrollable;
  }
  @Input() set isScrollable(d: boolean) {
    this._isScrollable = d;
  }

  private helpDialog?: DialogRef<unknown>;

  protected openDialog(ref: TemplateRef<unknown>) {
    this.helpDialog = this.dialogService.open(ref);
  }

  protected closeDialog() {
    this.helpDialog?.close();
  }
}
