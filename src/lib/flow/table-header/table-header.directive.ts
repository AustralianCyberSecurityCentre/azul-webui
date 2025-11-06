import { Directive, ElementRef, inject } from "@angular/core";

// https://flowbite.com/docs/components/tables/

@Directive({
  selector: "[flowTableHeader]",
  standalone: true,
})
export class TableHeaderDirective {
  constructor() {
    const el = inject(ElementRef);

    el.nativeElement.classList.add(
      ..."text-xs leading-5 text-gray-700 uppercase bg-azul-50 dark:bg-azul-700 dark:text-gray-400".split(
        " ",
      ),
    );
  }
}
