import { Directive, ElementRef, OnChanges, inject, input } from "@angular/core";

// https://flowbite.com/docs/components/tables/

@Directive({
  selector: "[flowTableBodyRow]",
  standalone: true,
})
export class TableBodyRowDirective implements OnChanges {
  private el = inject(ElementRef);

  noBorder = input<boolean>(false);
  strongBorder = input<boolean>(false);

  constructor() {
    const el = this.el;

    el.nativeElement.classList.add(
      ..."bg-white dark:bg-azul-800 hover:bg-gray-200 dark:hover:bg-gray-700".split(
        " ",
      ),
    );
    this.calculateBorder();
  }

  ngOnChanges() {
    this.calculateBorder();
  }

  private calculateBorder() {
    const classes = "border-b border-azul-300 dark:border-azul-700".split(" ");
    const strongClasses = "border-b-2 dark:border-b dark:border-azul-50".split(
      " ",
    );
    if (this.noBorder()) {
      this.el.nativeElement.classList.remove(...classes);
      this.el.nativeElement.classList.remove(...strongClasses);
    } else if (this.strongBorder()) {
      this.el.nativeElement.classList.remove(...classes);
      this.el.nativeElement.classList.add(...strongClasses);
    } else {
      this.el.nativeElement.classList.remove(...strongClasses);
      this.el.nativeElement.classList.add(...classes);
    }
  }
}
