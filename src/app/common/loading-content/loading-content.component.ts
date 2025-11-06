import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

import { Observable, of } from "rxjs";
import * as ops from "rxjs/operators";

/**In an nebular card, show a loading spinner or the required content if finished loading*/
@Component({
  selector: "az-loading-content",
  templateUrl: "./loading-content.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LoadingContentComponent<T> {
  dbg = (...d) => console.debug("LoadingContentComponent:", ...d);
  err = (...d) => console.error("LoadingContentComponent:", ...d);

  /**the data to tell whether things are loading still or complete or errored*/
  protected _obs$: Observable<T>;
  get obs$() {
    return this._obs$;
  }
  @Input() set obs$(d) {
    this._obs$ = d;
    this.reset();
  }
  protected _isCheckObsIsTrue: boolean = false;
  get isCheckObsIsTrue() {
    return this._isCheckObsIsTrue;
  }
  @Input() set isCheckObsIsTrue(checkObsTrue: boolean) {
    this._isCheckObsIsTrue = checkObsTrue;
  }

  protected doneLoading$: Observable<boolean>;
  protected error$: Observable<Error>;

  reset() {
    if (!this.obs$) {
      return;
    }

    this.doneLoading$ = this.obs$.pipe(
      ops.map((d) => {
        if (this.isCheckObsIsTrue) {
          return d === true;
        }
        return true;
      }),
      ops.startWith(false),
      ops.shareReplay(1),
    );

    this.error$ = this.obs$.pipe(
      ops.shareReplay(1),
      ops.filter(() => false),
      ops.catchError((error) => {
        this.err(error);
        return of(error);
      }),
    );
  }
}
