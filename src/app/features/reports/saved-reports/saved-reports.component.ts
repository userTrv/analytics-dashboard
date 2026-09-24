import { Component, input, output, signal } from '@angular/core';
import { formatDate } from '../../../shared/format/format';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SavedReport } from '../report-storage.service';

/** List of saved report definitions with inline rename and two-step delete. */
@Component({
  selector: 'app-saved-reports',
  imports: [IconComponent],
  templateUrl: './saved-reports.component.html',
  styleUrl: './saved-reports.component.scss',
})
export class SavedReportsComponent {
  readonly reports = input.required<readonly SavedReport[]>();
  readonly activeId = input<string | null>(null);
  readonly open = output<SavedReport>();
  readonly rename = output<{ id: string; name: string }>();
  readonly duplicate = output<string>();
  readonly remove = output<string>();

  protected readonly editing = signal<string | null>(null);
  protected readonly confirming = signal<string | null>(null);
  protected readonly formatDate = formatDate;

  protected commitRename(id: string, name: string): void {
    if (name.trim()) this.rename.emit({ id, name });
    this.editing.set(null);
  }

  protected confirmDelete(id: string): void {
    if (this.confirming() === id) {
      this.remove.emit(id);
      this.confirming.set(null);
    } else {
      this.confirming.set(id);
    }
  }
}
