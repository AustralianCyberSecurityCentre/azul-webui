import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { TextIconComponent } from "@app/common/text-icon/text-icon.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
//import { IconProp } from "@fortawesome/fontawesome-svg-core";

// Custom component, for providing a visually separated card header

@Component({
  selector: "flow-card-header",
  templateUrl: "./card-header.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FontAwesomeModule, TextIconComponent],
})
export class CardHeaderComponent {
  @Input()
  title: string | undefined;

  @Input()
  icon: string | undefined;

  @Input()
  id: string | undefined;

  @Input()
  scroll: boolean | undefined;
}
