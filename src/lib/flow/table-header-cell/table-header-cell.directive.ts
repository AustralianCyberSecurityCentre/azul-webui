import { Directive, ElementRef, inject } from "@angular/core";

// https://flowbite.com/docs/components/tables/

@Directive({
  selector: "[flowTableHeaderCell]",
  standalone: true,
})
export class TableHeaderCellDirective {
  constructor() {
    const el = inject(ElementRef);

    el.nativeElement.setAttribute("scope", "col");
    el.nativeElement.classList.add(..."px-3 py-1".split(" "));
  }
}
