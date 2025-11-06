import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class OffsetGraphService {
  dbg = (...d) => console.debug("OffsetGraphService:", ...d);
  err = (...d) => console.error("OffsetGraphService:", ...d);

  constructor() {}
}
