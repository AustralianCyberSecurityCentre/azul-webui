/** Allows continuous scrolling of table
 * This is designed to be used with a <cdk-virtual-scroll-viewport> and can retrieve new data and align elements.
 *  e.g.
 *
 *       <table>
 *           <thead>
 *               <tr>
 *                   <th>Header</th>
 *               </tr>
 *           </thead>
 *       </table>
 *       <cdk-virtual-scroll-viewport [itemSize]="ContinuousScroll.item_size" minBufferPx="5000" maxBufferPx="15000" [style.height]="'min(70vh, ' + ContinuousScroll.table_height + 'px)'"
 *           [style.min-width.px]="ContinuousScroll.table_width" (scrolledIndexChange)="ContinuousScroll.loadMore($event)"
 *           <div *cdkVirtualFor="let row of d.data;" >
 *               {{data}}
 *           </div>
 *       </cdk-virtual-scroll-viewport>
 *
 *
 * Feautures:
 *  Auto loading new data
 *  - update() will be called when user has scrolled 80% down.
 *      This should be overridden with a function that retrieves the new data.
 *      This should be called once manually after class has been set up to populate first set of data
 *      This function should call reset() to allow update() to be successfully called again
 *      e.g.
 *          update() {
 *              this.getNewData().subscribe((data)=> {
 *                  //do something
 *                  this.ContinuousScroll.reset(backoff, offset, has_more)
 *              }
 *          }
 */
export class ContinuousScroll {
  public offset: number = 0; //offset of data
  private _backOff: boolean = false; //wait before next http call
  private _has_more: boolean = true; //more data on server

  /** init scrolling on element with id: elementId */
  constructor() {}

  /** Check if we should load next values */
  loadMore(event: number) {
    if (!this._backOff && this._has_more) {
      if (event / this.getDataLength() >= 0.8) {
        this._backOff = true;
        this.update();
      }
    }
  }

  /** get next values */
  update() {
    throw new Error("Not implemented");
  }

  /** we can now get new values */
  reset(backoff: boolean, offset: number, has_more: boolean) {
    this._backOff = backoff;
    this.offset = offset;
    this._has_more = has_more;
  }

  /** Get number of elements in view point */
  getDataLength(): number {
    throw new Error("Not implemented");
  }
}
