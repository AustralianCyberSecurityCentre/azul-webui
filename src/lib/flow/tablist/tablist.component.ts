import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  OnChanges,
  Signal,
  signal,
  TemplateRef,
  WritableSignal,
} from "@angular/core";
import { ButtonLabelComponent } from "../button-label/button-label.component";

// https://flowbite.com/docs/components/tabs/

export type Tab = {
  name: string;
  template: TemplateRef<unknown>;
  disabled?: boolean;
  context?: unknown;
  count?: string;
};

@Component({
  selector: "flow-tablist",
  templateUrl: "./tablist.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonLabelComponent],
})
export class TablistComponent implements OnChanges {
  tabs = input<Tab[]>([]);

  protected currentTabSignal: WritableSignal<number> = signal(0);
  protected currentTabTemplateSignal: Signal<TemplateRef<unknown>> = computed(
    () => {
      return this.tabs()[this.currentTabSignal()]?.template;
    },
  );
  protected currentTabContextSignal: Signal<unknown> = computed(() => {
    return this.tabs()[this.currentTabSignal()]?.context;
  });

  ngOnChanges() {
    if (this.tabs().length === 0) {
      return;
    }

    const currentValue = this.currentTabSignal();

    if (
      currentValue >= this.tabs().length ||
      this.tabs()[currentValue].disabled
    ) {
      const validTab = this.tabs().findIndex((tab) => !(tab.disabled ?? false));
      if (validTab != -1) {
        this.onTabClick(validTab);
      }
    }
  }

  onTabClick(tab: number) {
    this.currentTabSignal.set(tab);
  }
}
