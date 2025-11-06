import { Directive, ElementRef, Input, OnChanges, inject } from "@angular/core";

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

  @Input()
  protected no_underline: boolean = false;
  @Input()
  protected link_colour = LinkColour.Blue;

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

    if (!this.no_underline) {
      // Remove underline default and show underline on hover
      this.el.nativeElement.classList.remove(
        ...["underline", "hover:no-underline"],
      );
      this.el.nativeElement.classList.add(
        ...["no-underline", "hover:underline"],
      );
    }

    if (this.link_colour.includes("white")) {
      // Remove default blue and add white
      this.el.nativeElement.classList.remove(...default_colour);
      this.el.nativeElement.classList.add(...white_classes);
    }
  }
}
