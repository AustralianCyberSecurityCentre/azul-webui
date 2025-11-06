import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ButtonComponent } from "./button/button.component";
import { CardComponent } from "./card/card.component";
import { CardBodyComponent } from "./card-body/card-body.component";
import { CardFooterComponent } from "./card-footer/card-footer.component";
import { TooltipComponent } from "./tooltip/tooltip.component";
import { CardHeaderComponent } from "./card-header/card-header.component";
import { CheckboxComponent } from "./checkbox/checkbox.component";
import { InputComponent } from "./input/input.component";
import { SelectDirective } from "./select/select.directive";
import { LabelComponent } from "./label/label.component";
import { ButtonLabelComponent } from "./button-label/button-label.component";
import { ToggleComponent } from "./toggle/toggle.component";
import { ProgressComponent } from "./progress/progress.component";
import { CheckboxLabelComponent } from "./checkbox-label/checkbox-label.component";
import { TablistComponent } from "./tablist/tablist.component";
import { HRComponent } from "./hr/hr.component";
import { TextareaComponent } from "./textarea/textarea.component";
import { AlertComponent } from "./alert/alert.component";
import { LinkDirective } from "./link/link.directive";
import { TableDirective } from "./table/table.directive";
import { TableHeaderDirective } from "./table-header/table-header.directive";
import { TableHeaderCellDirective } from "./table-header-cell/table-header-cell.directive";
import { TableHeaderRowDirective } from "./table-header-row/table-header-row.directive";
import { TableBodyDirective } from "./table-body/table-body.directive";
import { TableBodyRowDirective } from "./table-body-row/table-body-row.directive";
import { TableBodyCellDirective } from "./table-body-cell/table-body-cell.directive";
import { AccordionComponent } from "./accordion/accordion.component";
import { AccordionContentComponent } from "./accordion/accordion-content.component";
import { AccordionPanelComponent } from "./accordion/accordion-panel.component";
import { AccordionTitleComponent } from "./accordion/accordion-title.component";
import { IndicatorComponent } from "./indicator/indicator.component";
import { MarkdownComponent } from "./markdown/markdown.component";
import { TypedTemplateDirective } from "../template-type/template-type.directive";

@NgModule({
  imports: [
    FormsModule,
    ReactiveFormsModule,
    AccordionComponent,
    AccordionContentComponent,
    AccordionPanelComponent,
    AccordionTitleComponent,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    CardFooterComponent,
    CheckboxComponent,
    CheckboxLabelComponent,
    HRComponent,
    IndicatorComponent,
    InputComponent,
    MarkdownComponent,
    ProgressComponent,
    SelectDirective,
    TableDirective,
    TableBodyDirective,
    TableBodyCellDirective,
    TableBodyRowDirective,
    TableHeaderDirective,
    TableHeaderCellDirective,
    TableHeaderRowDirective,
    TablistComponent,
    TextareaComponent,
    ToggleComponent,
    TooltipComponent,
    LabelComponent,
    ButtonLabelComponent,
    LinkDirective,
    TypedTemplateDirective,
  ],
  exports: [
    FormsModule,
    AccordionComponent,
    AccordionContentComponent,
    AccordionPanelComponent,
    AccordionTitleComponent,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    CardFooterComponent,
    CheckboxComponent,
    CheckboxLabelComponent,
    HRComponent,
    IndicatorComponent,
    InputComponent,
    MarkdownComponent,
    ProgressComponent,
    SelectDirective,
    TableDirective,
    TableBodyDirective,
    TableBodyCellDirective,
    TableBodyRowDirective,
    TableHeaderDirective,
    TableHeaderCellDirective,
    TableHeaderRowDirective,
    TablistComponent,
    TextareaComponent,
    ToggleComponent,
    TooltipComponent,
    LabelComponent,
    ButtonLabelComponent,
    LinkDirective,
    TypedTemplateDirective,
  ],
})
export class FlowModule {}
