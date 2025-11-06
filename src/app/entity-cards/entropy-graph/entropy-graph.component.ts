import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import { BehaviorSubject } from "rxjs";
import { BaseCard } from "../base-card.component";

/**card showing the entropy diagram for an entity*/
@Component({
  selector: "azec-entropy-graph",
  templateUrl: "./entropy-graph.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EntropyGraphComponent extends BaseCard {
  help = `
Shows a graphical representation of the complexity of the binary.
The binary is divided into chunks and entropy of these chunks is measured.
The maximum possible entropy for a binary is 8.
Entropy is only calculated if we have the binary in Azul.
  `;

  protected faEye = faEye;

  @Input()
  protected height = "200px";

  protected showGraphLevels$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(true);

  protected hideLevelToggle() {
    this.showGraphLevels$.next(!this.showGraphLevels$.value);
  }
}
