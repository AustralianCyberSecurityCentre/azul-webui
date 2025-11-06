import { Directive, ElementRef, Input, OnChanges, inject } from "@angular/core";

// https://flowbite.com/docs/components/tables/

@Directive({
  selector: "[flowTableBodyRow]",
  standalone: true,
})
export class TableBodyRowDirective implements OnChanges {
  private el = inject(ElementRef);

  @Input()
  noBorder: boolean = false;

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
    const classes = "border-b dark:border-azul-700".split(" ");

    if (this.noBorder) {
      this.el.nativeElement.classList.remove(...classes);
    } else {
      this.el.nativeElement.classList.add(...classes);
    }
  }
}
