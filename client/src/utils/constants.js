// Target 12-stage bug workflow + special states
export const BUG_STATUSES = [
  'New',
  'Open',
  'Assigned',
  'In Progress',
  'Fixed',
  'Ready for QA',
  'In QA Testing',
  'QA Failed',
  'Verified by QA',
  'Approved by PM',
  'Done',
  'Reopened',
  'Deferred',
  'Duplicate',
  'Rejected',
  // Legacy values still accepted so old DB rows don't break
  'In Review',
  'Checked by QA',
  'Failed QA',
  'Checked by Product Manager',
  'Ready for Deployment',
];

export const BUG_STATUS_STAGES = {
  Intake:   ['New', 'Open'],
  Dev:      ['Assigned', 'In Progress', 'Fixed'],
  QA:       ['Ready for QA', 'In QA Testing', 'QA Failed', 'Verified by QA'],
  Closure:  ['Approved by PM', 'Done'],
  Special:  ['Reopened', 'Deferred', 'Duplicate', 'Rejected'],
};

export const TASK_STATUSES = ['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed', 'Done'];

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
export const SEVERITIES = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'];

export const ROLES = [
  'Admin',
  'Project Manager',
  'QA Lead',
  'QA Tester',
  'Developer',
  'Viewer',
  // Legacy
  'QA',
  'Product Manager',
  'Standard User',
];
