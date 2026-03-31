import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import {
  faBackwardStep,
  faForwardStep,
  faPause,
  faPlay,
} from "@fortawesome/free-solid-svg-icons";
import {
  BehaviorSubject,
  from,
  Observable,
  of,
  ReplaySubject,
  Subscription,
} from "rxjs";
import * as ops from "rxjs/operators";
import { StreamMetadataWithAuthor } from "src/app/common/misc-interfaces/stream-metadata";
import { Entity } from "src/app/core/services";
import { BaseCard } from "../base-card.component";

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
  private TIME_BETWEEN_FRAMES_MS = 500;
  private ANIMATED_IMAGE_TYPES = ["image/gif", "image/webp"];

  displayImage$: ReplaySubject<boolean> = new ReplaySubject();

  @Input()
  protected streamData: StreamMetadataWithAuthor;

  @Input({ required: true })
  protected fileFormat: string;

  @ViewChild("imageCanvas")
  private canvasRef: ElementRef<HTMLCanvasElement>;

  private gifSub: Subscription;
  private imgDecoder: ImageDecoder;

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
  private objectUrl?: string;

  protected imageBlob$: Observable<Blob>;
  protected imageUrl$: Observable<string>;

  // Note this can be either the current frame or the frame that is going to be rendered after a delay.
  // Which is why there is a seperate subject that tracks the actual index that is being rendered.
  private desiredFrameIndexSubject: BehaviorSubject<number> =
    new BehaviorSubject(0);

  // Canvas frame tracking signals
  protected currentFrameIndex: WritableSignal<number> = signal(0);
  protected isUsingCanvasSignal: WritableSignal<boolean> = signal(false);
  protected maxIndexSignal: WritableSignal<number> = signal(-1);
  protected autoPlayEnabled: WritableSignal<boolean> = signal(false);

  // Button icons
  protected faPlay = faPlay;
  protected faPause = faPause;
  protected faForwardStep = faForwardStep;
  protected faBackwardStep = faBackwardStep;

  constructor() {
    super();
    this.isImageHidden = JSON.parse(
      localStorage.getItem(this.hideImageLocalStorageKey) ||
        String(this.isImageHidden),
    );
  }

  private advanceImageByFrame() {
    this.desiredFrameIndexSubject.next(this.desiredFrameIndexSubject.value + 1);
  }

  advanceByFrameAndStopAutoplay() {
    this.autoPlayEnabled.set(false);
    this.advanceImageByFrame();
  }

  retreatImageByFrame() {
    this.autoPlayEnabled.set(false);
    let newImageIndexValue = this.desiredFrameIndexSubject.value - 1;
    if (newImageIndexValue < 0) {
      newImageIndexValue = this.maxIndexSignal() - 1;
    }
    this.desiredFrameIndexSubject.next(newImageIndexValue);
  }

  toggleAutoPlay() {
    this.autoPlayEnabled.update((prev) => !prev);
    // If play has started move by one frame to get everything moving
    if (this.autoPlayEnabled()) {
      this.advanceImageByFrame();
    }
  }

  renderImageOnCanvas(decodedImage: ImageDecodeResult | null): void {
    if (decodedImage === null) {
      this.desiredFrameIndexSubject.next(0);
      return;
    }
    const canvas2d = this.canvasRef.nativeElement.getContext("2d");
    // Ensure canvas and image are equally sized
    this.canvasRef.nativeElement.height = decodedImage.image.displayHeight;
    this.canvasRef.nativeElement.width = decodedImage.image.displayWidth;

    canvas2d.drawImage(decodedImage.image, 0, 0);
    this.currentFrameIndex.set(this.desiredFrameIndexSubject.value);

    if (this.autoPlayEnabled()) {
      // Wait 500ms and then check if a pause has occurred before advancing.
      // This allows for the pause to occur on the frame you are on.
      setTimeout(() => {
        if (this.autoPlayEnabled()) {
          this.advanceImageByFrame();
        }
      }, this.TIME_BETWEEN_FRAMES_MS);
    }
  }

  setupCanvasBasedRendering() {
    this.isUsingCanvasSignal.set(true);
    this.gifSub = this.imageBlob$
      .pipe(
        ops.switchMap((imageStream: Blob) => {
          return from(imageStream.arrayBuffer());
        }),
        ops.map((imgArrayBuffer) => {
          this.imgDecoder?.close();
          // Note ImageDecoder only works with newer browsers, if this fails the error handler switches to just rendering an image.
          this.imgDecoder = new ImageDecoder({
            data: imgArrayBuffer,
            type: this.fileFormat,
          });
          this.displayImage$?.next(true);
          return this.imgDecoder;
        }),
        ops.shareReplay(),
        ops.combineLatestWith(this.desiredFrameIndexSubject),
        ops.switchMap(([imgDecoder, imgIndex]) => {
          return from(imgDecoder.decode({ frameIndex: imgIndex })).pipe(
            ops.catchError((e, _caughtObs) => {
              if (e instanceof RangeError) {
                return of(null);
              }
              throw e;
            }),
          );
        }),
        ops.catchError((e, _caughtObs) => {
          // Catch error and switch over to image based rendering, because the canvas has crashed.
          // This is expected to occur for older browsers.
          console.error(e);
          this.setupImageBasedRendering();
          return of(null);
        }),
      )
      .subscribe((decodedImage: ImageDecodeResult | null) => {
        // Wait until after image has been decoded because that's when frameCount should be known.
        if (
          this.maxIndexSignal() <= 0 &&
          this.imgDecoder.tracks[0]?.frameCount !== undefined
        ) {
          let totalFrameCount = 0;
          for (let i = 0; i < this.imgDecoder.tracks.length; i++) {
            totalFrameCount += this.imgDecoder.tracks[i]?.frameCount;
          }
          this.maxIndexSignal.set(totalFrameCount);
        }
        this.renderImageOnCanvas(decodedImage);
      });
  }

  setupImageBasedRendering() {
    this.isUsingCanvasSignal.set(false);
    this.imageUrl$ = this.imageBlob$.pipe(
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

  ngOnInit(): void {
    this.imageBlob$ = this.entityService.streamBlob(
      this._entity.sha256,
      this.streamData.datastream_sha256,
    );

    if (this.ANIMATED_IMAGE_TYPES.includes(this.fileFormat)) {
      this.setupCanvasBasedRendering();
    } else {
      this.setupImageBasedRendering();
    }
  }

  ngOnDestroy() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    this.gifSub?.unsubscribe();
    this.imgDecoder?.close();
  }

  toggleIsImageHidden() {
    localStorage.setItem(
      this.hideImageLocalStorageKey,
      String(this.isImageHidden),
    );
  }
}
