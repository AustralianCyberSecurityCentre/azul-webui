import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from "@angular/core";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { StreamMetadataWithAuthor } from "src/app/common/misc-interfaces/stream-metadata";
import { EntityService } from "src/app/core/entity.service";
import { BaseCard } from "../base-card.component";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";

@Component({
  selector: "azec-pdf-preview",
  templateUrl: "./pdf-preview.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PdfPreviewComponent extends BaseCard implements OnInit, OnDestroy {
  private entityService = inject(EntityService);
  private sanitizer = inject(DomSanitizer);

  help = `The PDF preview card provides a PDF preview of a PDF attachment.

This is rendered using your browser's PDF viewer.
`;
  @Input()
  protected streamData?: StreamMetadataWithAuthor;

  protected pdfUrl$: Observable<SafeResourceUrl>;

  private objectUrl: string | undefined = undefined;

  ngOnInit() {
    this.pdfUrl$ = this.entityService
      .streamBlob(this._entity.sha256, this.streamData.datastream_sha256)
      .pipe(
        ops.map((docStream: Blob) => {
          if (docStream === null || docStream === undefined) {
            return undefined;
          }
          if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
          }
          this.objectUrl = URL.createObjectURL(docStream);
          // URL is safe to use as it is directly created by the browser
          return this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
        }),
        ops.shareReplay(),
      );
  }

  ngOnDestroy() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
  }
}
