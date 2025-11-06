import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import showdown from "showdown";

// https://flowbite.com/docs/typography/blockquote/

@Component({
  selector: "flow-markdown",
  templateUrl: "./markdown.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FontAwesomeModule],
})
export class MarkdownComponent implements OnChanges {
  @Input()
  private markdown: string;
  @Input()
  protected asQuote: boolean = true;

  protected renderedMarkdown: string;

  private converter = new showdown.Converter({
    strikethrough: true,
    tables: true,
    ghCodeBlocks: true,
    simpleLineBreaks: true,
    encodeEmails: false,
    openLinksInNewWindow: true,
    underline: true,
  });

  ngOnChanges() {
    this.renderedMarkdown = this.converter.makeHtml(this.markdown);
  }
}
