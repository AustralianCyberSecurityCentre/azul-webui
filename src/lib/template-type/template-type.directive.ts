import { Directive, Input, TemplateRef, inject } from "@angular/core";

// Taken from https://stackoverflow.com/questions/55458421/ng-template-typed-variable

// Disabling linter for this line as we are addinging functionallity to ng-template.
// eslint-disable-next-line @angular-eslint/directive-selector
@Directive({ selector: "ng-template[typedTemplate]", standalone: true })
export class TypedTemplateDirective<TypeToken> {
  private contentTemplate = inject<TemplateRef<TypeToken>>(TemplateRef);

  // how you tell the directive what the type should be
  @Input("typedTemplate")
  typeToken: TypeToken;

  // this magic is how we tell Angular the context type for this directive, which then propagates down to the type of the template
  static ngTemplateContextGuard<TypeToken>(
    dir: TypedTemplateDirective<TypeToken>,
    ctx: unknown,
  ): ctx is TypeToken {
    return true;
  }
}
