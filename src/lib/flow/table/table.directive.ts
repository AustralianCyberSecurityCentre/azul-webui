import { Directive, ElementRef, inject } from "@angular/core";

// https://flowbite.com/docs/components/tables/

@Directive({
  selector: "[flowTable]",
  standalone: true,
})
export class TableDirective {
  constructor() {
    const el = inject(ElementRef);

    el.nativeElement.classList.add(
      ..."text-sm text-left text-gray-600 dark:text-gray-300".split(" "),
    );
  }
}
