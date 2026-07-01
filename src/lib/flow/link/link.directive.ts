import { Directive, ElementRef, OnChanges, inject, input } from "@angular/core";

// https://flowbite.com/docs/typography/links/

export enum LinkColour {
  White = "white",
  Blue = "blue",
}

@Directive({
  selector: "[flowLink]",
  standalone: true,
})
export class LinkDirective implements OnChanges {
  private el = inject(ElementRef);

  noUnderline = input<boolean>(false);
  linkColour = input<LinkColour>(LinkColour.Blue);

  constructor() {
    this.el.nativeElement.classList.add(
      ..."text-blue-500 dark:text-blue-300 font-medium underline hover:no-underline".split(
        " ",
      ),
    );
  }

  ngOnChanges() {
    const default_colour = "text-blue-500 dark:text-blue-300".split(" ");
    const white_classes = "text-white-500 dark:text-white-300".split(" ");

    if (!this.noUnderline()) {
      // Remove underline default and show underline on hover
      this.el.nativeElement.classList.remove(
        ...["underline", "hover:no-underline"],
      );
      this.el.nativeElement.classList.add(
        ...["no-underline", "hover:underline"],
      );
    }

    if (this.linkColour().includes("white")) {
      // Remove default blue and add white
      this.el.nativeElement.classList.remove(...default_colour);
      this.el.nativeElement.classList.add(...white_classes);
    }
  }
}
