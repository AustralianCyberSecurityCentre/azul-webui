import {
  Component,
  Input,
  TemplateRef,
  ChangeDetectionStrategy,
  inject,
} from "@angular/core";
import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";

@Component({
  selector: "az-page-help",
  templateUrl: "./page-help.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PageHelpComponent {
  private dialogService = inject(Dialog);

  questionIcon = faQuestionCircle;

  @Input() title = "";
  @Input() help = "";
  @Input() bgClass = "bg-azul-100/80 dark:bg-azul-500";

  private helpDialog?: DialogRef<unknown>;

  openDialog(ref: TemplateRef<unknown>) {
    this.helpDialog = this.dialogService.open(ref);
  }

  closeDialog() {
    this.helpDialog?.close();
  }

  get showHelp(): boolean {
    return !!this.help?.trim();
  }
}
