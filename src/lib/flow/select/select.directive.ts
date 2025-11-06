import { Directive, ElementRef, Input, OnChanges, inject } from "@angular/core";

// https://flowbite.com/docs/forms/select/

@Directive({
  selector: "[flowSelect]",
  standalone: true,
})
export class SelectDirective implements OnChanges {
  private el = inject(ElementRef);

  @Input() invalid: boolean = false;
  @Input() noRightPadding: boolean = false; // Remove right padding when using flowSelect outside of a dropdown select.
  @Input() fieldSize: "large" | "medium" | "small" = "medium";

  constructor() {
    this.el.nativeElement.classList.add(
      ...`
          block rounded-lg border bg-azul-50 p-2.5 text-sm text-gray-900
          focus:border-blue-500 focus:ring-blue-500 dark:bg-azul-700 dark:text-white
          dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500
        `
        .trim()
        .split(/\s+/),
    );

    this.ngOnChanges();
  }

  ngOnChanges() {
    const invalidClasses = "border-red-500 dark:border-red-500".split(" ");
    const notInvalidClasses = "border-gray-300 dark:border-gray-600".split(" ");

    if (this.invalid) {
      this.el.nativeElement.classList.remove(...notInvalidClasses);
      this.el.nativeElement.classList.add(...invalidClasses);
    } else {
      this.el.nativeElement.classList.remove(...invalidClasses);
      this.el.nativeElement.classList.add(...notInvalidClasses);
    }

    // Padding
    const smallClasses = ["p-2", "sm:text-xs"];
    const mediumClasses = ["p-2.5", "text-sm"];
    const largeClasses = ["px-4", "py-3", "text-base"];

    if (this.noRightPadding) {
      this.el.nativeElement.classList.remove(["pr-8"]);
    } else {
      this.el.nativeElement.classList.add(["pr-8"]);
    }

    switch (this.fieldSize) {
      case "large":
        this.el.nativeElement.classList.remove(
          ...smallClasses,
          ...mediumClasses,
        );
        this.el.nativeElement.classList.add(...largeClasses);
        break;
      case "medium":
        this.el.nativeElement.classList.remove(
          ...smallClasses,
          ...largeClasses,
        );
        this.el.nativeElement.classList.add(...mediumClasses);
        break;
      case "small":
        this.el.nativeElement.classList.remove(
          ...mediumClasses,
          ...largeClasses,
        );
        this.el.nativeElement.classList.add(...smallClasses);
        break;
    }
  }
}
