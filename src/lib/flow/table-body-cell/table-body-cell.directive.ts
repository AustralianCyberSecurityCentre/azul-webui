import { Directive, ElementRef, Input, OnChanges, inject } from "@angular/core";

// https://flowbite.com/docs/components/tables/

@Directive({
  selector: "[flowTableBodyCell]",
  standalone: true,
})
export class TableBodyCellDirective implements OnChanges {
  private el = inject(ElementRef);

  @Input()
  rowHeader: boolean = false;

  constructor() {
    const el = this.el;

    el.nativeElement.classList.add(..."px-3 py-1".split(" "));
    el.nativeElement.classList.add(..."px-3 py-1".split(" "));
  }

  ngOnChanges() {
    const classes =
      "font-medium text-gray-900 whitespace-nowrap dark:text-white".split(" ");

    if (this.rowHeader) {
      this.el.nativeElement.classList.add(...classes);
    } else {
      this.el.nativeElement.classList.remove(...classes);
    }
  }
}
