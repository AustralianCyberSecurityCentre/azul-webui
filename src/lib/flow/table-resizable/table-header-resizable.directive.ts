import { AfterViewInit, Directive, ElementRef, Renderer2 } from "@angular/core";

@Directive({
  selector: "[tableHeaderResizable]",
})
export class TableHeaderResizableDirective implements AfterViewInit {
  private startX = 0;
  private startWidth = 0;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngAfterViewInit(): void {
    const resizer = this.renderer.createElement("span");

    this.renderer.addClass(resizer, "resizer");
    this.renderer.appendChild(this.el.nativeElement, resizer);

    this.renderer.listen(resizer, "mousedown", (event: MouseEvent) => {
      this.startX = event.pageX;
      this.startWidth = this.el.nativeElement.offsetWidth;

      const mouseMove = this.renderer.listen("document", "mousemove", (e) => {
        const dx = e.pageX - this.startX;
        this.renderer.setStyle(
          this.el.nativeElement,
          "width",
          `${this.startWidth + dx}px`,
        );
      });

      const mouseUp = this.renderer.listen("document", "mouseup", () => {
        mouseMove();
        mouseUp();
      });
    });
  }
}
