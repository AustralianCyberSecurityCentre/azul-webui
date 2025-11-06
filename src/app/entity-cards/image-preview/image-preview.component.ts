import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from "@angular/core";
import { Observable, ReplaySubject } from "rxjs";
import * as ops from "rxjs/operators";
import { Entity } from "src/app/core/services";
import { BaseCard } from "../base-card.component";
import { StreamMetadataWithAuthor } from "src/app/common/misc-interfaces/stream-metadata";

@Component({
  selector: "azec-image-preview",
  templateUrl: "./image-preview.component.html",
  styleUrls: ["./image-preview.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ImagePreviewComponent
  extends BaseCard
  implements OnInit, OnDestroy
{
  entityService = inject(Entity);

  help = `
  This panel displays a sanitized preview of the file if it is an image file type and it can be sanitized.
  `;

  _displayImage$?: ReplaySubject<boolean>;
  get displayImage$() {
    return this._displayImage$;
  }
  @Input() set displayImage$(d) {
    this._displayImage$ = d;
  }

  @Input()
  protected streamData: StreamMetadataWithAuthor;

  _isImageHidden: boolean = false;
  @Input() set isImageHidden(val) {
    this._isImageHidden = val;
  }
  get isImageHidden() {
    return this._isImageHidden;
  }
  get hideImageLocalStorageKey() {
    return `"hide_preview_image"`;
  }
  imageUrl$: Observable<string>;
  private objectUrl?: string;

  constructor() {
    super();
    this.isImageHidden = JSON.parse(
      localStorage.getItem(this.hideImageLocalStorageKey) ||
        String(this.isImageHidden),
    );
  }

  ngOnInit(): void {
    this.imageUrl$ = this.entityService
      .streamBlob(this._entity.sha256, this.streamData.datastream_sha256)
      .pipe(
        ops.map((imageStream: Blob) => {
          if (imageStream === null || imageStream === undefined) {
            return "";
          }
          if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
          }
          return (this.objectUrl = URL.createObjectURL(imageStream));
        }),
        ops.tap((dataUrl) => {
          if (dataUrl?.length > 0) {
            this.displayImage$?.next(true);
          }
        }),
        ops.shareReplay(),
      );
  }

  ngOnDestroy() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
  }

  toggleIsImageHidden() {
    localStorage.setItem(
      this.hideImageLocalStorageKey,
      String(this.isImageHidden),
    );
  }
}
