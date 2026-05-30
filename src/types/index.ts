export interface Brand {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isDefault: boolean;
}

export interface Subtask {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  brandId: string;
  text: string;
  note: string;
  isDone: boolean;
  date: string;
  doneDate: Date | null;
  recurType: string | null;
  recurTemplateId: string | null;
  subtasks?: Subtask[];
}

export interface DailyFocus {
  id: string;
  brandId: string;
  date: string;
  heading: string;
  note: string;
}

export interface NotepadTab {
  id: string;
  brandId: string;
  title: string;
  content: string;
  isArchived: boolean;
  archiveDate: string | null;
}

export interface RecurringTemplate {
  id: string;
  brandId: string;
  text: string;
  recurType: string;
  recurDays: string; // JSON string of days array
  isActive: boolean;
}
