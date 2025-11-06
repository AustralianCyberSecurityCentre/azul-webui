import { Directive, Input } from "@angular/core";
import { ReplaySubject } from "rxjs";

import { EntityWrap } from "src/app/core/services";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

@Directive()
export abstract class BaseCard {
  abstract help: string;

  // observable that returns the currently active entity
  protected _current_entity$ = new ReplaySubject<EntityWrap>();
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  _entity: EntityWrap;
  get entity(): EntityWrap {
    return this._entity;
  }
  @Input() set entity(d) {
    this._entity = d;
    this._current_entity$.next(d);
    this.onEntityChange();
  }

  protected onEntityChange(): void {}
}
