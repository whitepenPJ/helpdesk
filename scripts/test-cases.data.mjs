// Manual QA test cases for the Helpdesk app, one entry per module/"program".
// Consumed by scripts/gen-test-cases.mjs to build docs/test-cases.xlsx
// (a Summary sheet + one detail sheet per module).
//
// Shape:
//   { name, description, cases: [{ scenario, step, expected }] }
// Consecutive cases that share the same `scenario` string are merged into
// one Scenario cell on the sheet, mirroring the reference workbook.

/** @typedef {{ scenario: string, step: string, expected: string }} TestCase */
/** @typedef {{ name: string, description: string, cases: TestCase[] }} Module */

/** @type {Module[]} */
export const MODULES = [
  {
    name: "Authentication & Access",
    description: [
      "Sign-in (email + password via Credentials, and Microsoft Entra ID / Azure AD),",
      "sign-out, forgot-password, and route protection enforced by proxy.ts.",
      "Roles: ADMIN, SUPERVISOR (shown as \"Approver\" in the UI), USER.",
      "Demo accounts: admin@demo.com / supervisor@demo.com / user1@demo.com,",
      "all with password P@ssw0rd.",
    ].join("\n"),
    cases: [
      {
        scenario: "Credentials sign-in",
        step: "1. Open /login\n2. Enter admin@demo.com / P@ssw0rd\n3. Submit",
        expected: "Redirected to /dashboard (role home). Navbar shows the signed-in user. Session cookie is set.",
      },
      {
        scenario: "Credentials sign-in",
        step: "1. Open /login\n2. Enter a valid email with a wrong password\n3. Submit",
        expected: "Stays on /login with an \"invalid email or password\" error. No session is created.",
      },
      {
        scenario: "Credentials sign-in",
        step: "1. Sign in with an account whose status is INACTIVE or SUSPENDED",
        expected: "Sign-in is rejected even though the password is correct.",
      },
      {
        scenario: "Role-based landing",
        step: "1. Sign in as supervisor@demo.com\n2. Observe the landing page",
        expected: "Lands on /tickets/approval. A USER lands on /tickets; an ADMIN on /dashboard.",
      },
      {
        scenario: "Route protection",
        step: "1. While signed out, request /tickets directly",
        expected: "Redirected to /login?callbackUrl=/tickets. After signing in, returned to /tickets.",
      },
      {
        scenario: "Route protection",
        step: "1. While signed in, open /login",
        expected: "Redirected away from /login to the role home page.",
      },
      {
        scenario: "Microsoft Entra ID",
        step: "1. On /login click \"Sign in with Microsoft\"\n2. Complete the Microsoft prompt",
        expected: "Returns authenticated. A brand-new Entra account is created with role USER.",
      },
      {
        scenario: "Forgot password",
        step: "1. Open /forgot-password\n2. Submit a known email address",
        expected: "A neutral confirmation is shown (no account enumeration).",
      },
      {
        scenario: "Sign out",
        step: "1. From any page use the navbar \"Sign out\"",
        expected: "Session cleared; redirected to /login. Back button does not restore an authenticated view.",
      },
    ],
  },

  {
    name: "Dashboard",
    description: "Admin landing page: KPI tiles for ticket status buckets, recent activity, and quick links that deep-link into Ticket Management pre-filtered.",
    cases: [
      {
        scenario: "KPI tiles",
        step: "1. Sign in as admin\n2. Open /dashboard",
        expected: "Tiles show counts for Open (NEW/ASSIGNED/REOPENED), Pending Approval (WAITING) and Awaiting Customer Close (RESOLVED).",
      },
      {
        scenario: "KPI tiles",
        step: "1. Click the \"Open\" KPI tile",
        expected: "Navigates to Ticket Management with the Status filter already set to Open.",
      },
      {
        scenario: "Access control",
        step: "1. Sign in as a USER\n2. Request /dashboard directly",
        expected: "Not permitted for non-admins; redirected to the role home page.",
      },
      {
        scenario: "Empty state",
        step: "1. View the dashboard on a database with no tickets",
        expected: "Tiles render 0 without error; no broken charts.",
      },
    ],
  },

  {
    name: "Tickets - Create",
    description: "New ticket form (/tickets/new). Requires title, description and telephone. Category is required. When the category needs approval, an approver message is required. Company/Department come from the creator's profile.",
    cases: [
      {
        scenario: "Happy path",
        step: "1. Open /tickets/new\n2. Fill title, description, telephone, category\n3. Submit",
        expected: "Ticket created with a generated ticketNumber and status NEW. Redirected to the ticket detail page.",
      },
      {
        scenario: "Validation",
        step: "1. Submit the form with title / description / telephone blank (or whitespace only)",
        expected: "Inline errors on each empty field. Nothing is saved.",
      },
      {
        scenario: "Validation",
        step: "1. Submit without choosing a category",
        expected: "\"Select a category\" error; no ticket created.",
      },
      {
        scenario: "Approval-required category",
        step: "1. Choose a category that requires approval\n2. Leave the approver message blank\n3. Submit",
        expected: "\"Enter a message for the approver\" error. With a message, the ticket is created and an approval request is opened.",
      },
      {
        scenario: "Profile prerequisite",
        step: "1. As a user with no company/department set, submit a ticket",
        expected: "Blocked with a message to have an admin set company/department on the profile first.",
      },
      {
        scenario: "Open on behalf of others",
        step: "1. As an admin (or a user with canOpenTicketForOthers), open the form\n2. Change the Creator field",
        expected: "Creator selector is available and the ticket is filed for the chosen user. A normal user cannot change the creator.",
      },
      {
        scenario: "Attachments",
        step: "1. Attach one or more files\n2. Submit",
        expected: "Files are stored and listed on the ticket detail attachments section.",
      },
    ],
  },

  {
    name: "Tickets - List (My Tickets)",
    description: "The requester's own tickets at /tickets: search by title/number, status filter, sortable columns, pagination.",
    cases: [
      {
        scenario: "Listing",
        step: "1. Sign in as a user with tickets\n2. Open /tickets",
        expected: "Only tickets created by this user are listed, newest first by default.",
      },
      {
        scenario: "Search",
        step: "1. Type part of a ticket title or ticketNumber in the search box",
        expected: "List narrows to matches (case-insensitive). Clearing the box restores the full list.",
      },
      {
        scenario: "Status filter",
        step: "1. Choose a status from the filter dropdown",
        expected: "Only tickets in that status are shown; the choice is preserved in the URL and in pagination links.",
      },
      {
        scenario: "Sorting & paging",
        step: "1. Click a sortable column header\n2. Change rows-per-page\n3. Move to page 2",
        expected: "Sort direction toggles; page size persists; page navigation keeps the current search/filter/sort.",
      },
      {
        scenario: "Edit gating",
        step: "1. Open a ticket that is still NEW\n2. Open a ticket that has moved past NEW",
        expected: "Edit is offered only while the ticket is NEW (owner or admin).",
      },
    ],
  },

  {
    name: "Tickets - Detail",
    description: "Ticket detail page with explicit View and Edit modes. Shows requester, assignees, assigned group, department approvers, history timeline, comments and approval status.",
    cases: [
      {
        scenario: "Visibility (non-admin)",
        step: "1. As a user, open a ticket you did not create and are not assigned to",
        expected: "404 / not found. Visible only to the owner, an individual assignee, a member of the assigned group, or a department approver.",
      },
      {
        scenario: "Visibility (assigned group)",
        step: "1. Assign a ticket to a group\n2. Sign in as a member of that group\n3. Open the ticket",
        expected: "Ticket is visible. A user in none of the assigned groups still cannot see it.",
      },
      {
        scenario: "View / Edit modes",
        step: "1. Open a ticket in View mode\n2. Use the Edit link",
        expected: "View mode shows read-only fields plus an Edit link; Edit mode shows the editable form and admin actions.",
      },
      {
        scenario: "Deleted tickets",
        step: "1. As a non-admin, open a soft-deleted ticket by URL",
        expected: "Not found. Only admins see deleted tickets (via Ticket Management's \"Show deleted\").",
      },
      {
        scenario: "History timeline",
        step: "1. Perform a state change (assign, resolve, reopen)\n2. Reopen the detail page",
        expected: "A TicketHistory entry with actor and timestamp appears in the timeline.",
      },
    ],
  },

  {
    name: "Tickets - Assigned Queue",
    description: "/tickets/assigned - tickets assigned to the signed-in user individually (TicketAssignee) or to any group they belong to (TicketAssignedGroup, via UserGroupMember). Default order is assignee-actionability, not a plain column sort.",
    cases: [
      {
        scenario: "Membership scope",
        step: "1. Add the user to two groups, each assigned different tickets\n2. Open /tickets/assigned",
        expected: "Tickets from BOTH groups appear, plus any assigned to the user individually.",
      },
      {
        scenario: "Membership scope",
        step: "1. Remove the user from all groups\n2. Open /tickets/assigned",
        expected: "Only individually-assigned tickets remain; no group tickets leak through.",
      },
      {
        scenario: "Default ordering",
        step: "1. View the queue with no explicit sort",
        expected: "ASSIGNED/REOPENED/NEW first, then RESOLVED, then WAITING, then CLOSED.",
      },
      {
        scenario: "Search & status filter",
        step: "1. Search by title/number and apply a status filter",
        expected: "Results stay within the user's assigned scope and match the filters; paging preserves them.",
      },
    ],
  },

  {
    name: "Tickets - Approval Queue",
    description: "/tickets/approval - supervisors (department approvers) see pending TicketApproval requests for their department and approve or reject them. First approver to act wins.",
    cases: [
      {
        scenario: "Queue scope",
        step: "1. Sign in as a supervisor\n2. Open /tickets/approval",
        expected: "Only PENDING approvals for departments where the user is a DepartmentApprover are listed.",
      },
      {
        scenario: "Approve",
        step: "1. Open a pending request\n2. Approve with a comment",
        expected: "TicketApproval.status becomes APPROVED, decidedAt and supervisorId are recorded, and the ticket proceeds. History entry added.",
      },
      {
        scenario: "Reject",
        step: "1. Open a pending request\n2. Reject with a reason",
        expected: "Status becomes REJECTED with the reason stored; requester is notified; ticket does not proceed.",
      },
      {
        scenario: "Race / first-wins",
        step: "1. Two approvers open the same request\n2. Both submit a decision",
        expected: "The first decision is applied; the second sees that it is already decided and cannot override it.",
      },
      {
        scenario: "Authorization",
        step: "1. As a non-approver, POST a decision to the approval action directly",
        expected: "Rejected server-side (role/department re-checked in the Server Action).",
      },
    ],
  },

  {
    name: "Ticket Management (Admin)",
    description: "/transaction/ticket-management - admin triage: assign to users and/or groups, change status, soft-delete with a reason and restore, \"Show deleted\" filter, bulk-style row actions.",
    cases: [
      {
        scenario: "Assignment",
        step: "1. Open the Assign modal on a ticket\n2. Pick one or more assignees and/or one or more groups\n3. Save",
        expected: "TicketAssignee / TicketAssignedGroup rows are replaced to match the selection. Recipients are notified. History entry added.",
      },
      {
        scenario: "Assignment",
        step: "1. Clear all assignees and groups\n2. Save",
        expected: "Ticket shows as Unassigned.",
      },
      {
        scenario: "Soft delete",
        step: "1. Delete a ticket\n2. Submit with the reason blank",
        expected: "\"Enter a reason\" error. With a reason, deletedAt/deletedById are set and the ticket drops out of normal lists.",
      },
      {
        scenario: "Restore & show deleted",
        step: "1. Enable \"Show deleted\"\n2. Restore a deleted ticket",
        expected: "Deleted tickets are listed only with the filter on; restore clears deletedAt and returns it to normal lists.",
      },
      {
        scenario: "Status change",
        step: "1. Move a ticket NEW -> ASSIGNED -> RESOLVED -> CLOSED",
        expected: "Each transition is persisted with resolvedAt/closedAt set where relevant and a history entry per step.",
      },
    ],
  },

  {
    name: "Comments & Attachments",
    description: "Ticket comment thread. Anyone who can view a ticket can comment: owner, individual assignee, a member of any assigned group, or the reviewing supervisor. Comments may carry file attachments.",
    cases: [
      {
        scenario: "Add comment",
        step: "1. As the ticket owner, post a comment",
        expected: "Comment appears immediately with author and timestamp; assignees/watchers are notified.",
      },
      {
        scenario: "Validation",
        step: "1. Submit an empty or whitespace-only comment",
        expected: "\"Enter a comment\" error; nothing is posted.",
      },
      {
        scenario: "Permission - group member",
        step: "1. Assign the ticket to a group\n2. As a member of that group, post a comment",
        expected: "Allowed. A user in none of the assigned groups is refused (server-side check).",
      },
      {
        scenario: "Permission - outsider",
        step: "1. As an unrelated user, POST to the comment action directly",
        expected: "Rejected; no comment is stored.",
      },
      {
        scenario: "Attachments",
        step: "1. Attach a file to a comment and post",
        expected: "The attachment is saved and downloadable from the thread.",
      },
    ],
  },

  {
    name: "Notifications",
    description: "Header bell with an unread badge, a notifications list, and a \"seen\" marker (User.notificationsSeenAt) that clears the badge. Unread count is also exposed via /api/notifications/unread-count.",
    cases: [
      {
        scenario: "Badge",
        step: "1. Trigger an event that notifies the user (assignment, comment, approval decision)\n2. Look at the header bell",
        expected: "Unread badge count increases.",
      },
      {
        scenario: "Mark seen",
        step: "1. Open the notifications dropdown / page",
        expected: "notificationsSeenAt is updated; the badge clears while older items remain listed.",
      },
      {
        scenario: "Deep link",
        step: "1. Click a notification row",
        expected: "Navigates to the related ticket/approval.",
      },
      {
        scenario: "API",
        step: "1. GET /api/notifications/unread-count while signed in",
        expected: "Returns the current unread count for the caller only.",
      },
    ],
  },

  {
    name: "Global Search",
    description: "/search and /api/tickets/search - searches tickets and related records scoped to the caller's role/programs (admins see all; users see their own; assignees see their queue).",
    cases: [
      {
        scenario: "Scope",
        step: "1. As a USER, search a term that matches another user's ticket",
        expected: "That ticket is not returned; only the caller's own / assigned records match.",
      },
      {
        scenario: "Matching",
        step: "1. Search a partial ticket title and a partial ticketNumber",
        expected: "Both return the ticket (case-insensitive contains).",
      },
      {
        scenario: "Empty query",
        step: "1. Submit an empty search",
        expected: "No results and no error.",
      },
      {
        scenario: "Result cap",
        step: "1. Search a very common term",
        expected: "Results are capped to a sane maximum rather than returning everything.",
      },
    ],
  },

  {
    name: "Master - Users",
    description: "/master/user (admin) - list with search + role filter, create/edit/view, set role and status, assign company/department/telephone, import from Excel, export to Excel.",
    cases: [
      {
        scenario: "Create",
        step: "1. Create a user with name, email, role, password (>= 8 chars)",
        expected: "User is created ACTIVE. Duplicate email is rejected. Blank name / invalid email / short password are rejected.",
      },
      {
        scenario: "Edit",
        step: "1. Change a user's role and status\n2. Save",
        expected: "Changes persist. A suspended/inactive user can no longer sign in.",
      },
      {
        scenario: "List filters",
        step: "1. Filter by role and search by name/email",
        expected: "List narrows correctly; filter + search are both preserved in pagination and the export link.",
      },
      {
        scenario: "Import",
        step: "1. Upload a valid users .xlsx\n2. Upload a malformed file",
        expected: "Valid rows are created/updated with a summary; a malformed file is reported without partial corruption.",
      },
      {
        scenario: "Export",
        step: "1. Click Export with a role filter active",
        expected: "Downloaded .xlsx contains exactly the filtered users, including company and department columns.",
      },
      {
        scenario: "Company / Department display",
        step: "1. Open a user with a department assigned",
        expected: "Company and Department names render (via the renamed `department` relation).",
      },
    ],
  },

  {
    name: "Master - User Groups",
    description: "/master/user-group (admin) - assignment pools. A user may belong to MANY groups (UserGroupMember join). Create stages members client-side; edit replaces membership wholesale; delete is blocked while the group has members or assigned tickets.",
    cases: [
      {
        scenario: "Create with members",
        step: "1. Create a group and stage several users as members\n2. Save",
        expected: "Group is created and one UserGroupMember row per staged user is written.",
      },
      {
        scenario: "Multi-group membership",
        step: "1. Add user X to Group A\n2. Also add user X to Group B",
        expected: "X is a member of BOTH groups; adding to B does not remove X from A.",
      },
      {
        scenario: "Edit membership",
        step: "1. Open Group A edit\n2. Remove one member, add another\n3. Save",
        expected: "Group A's membership matches the staged list exactly; the removed user's memberships in OTHER groups are untouched.",
      },
      {
        scenario: "Validation",
        step: "1. Save a group with a blank name, or a name that already exists",
        expected: "\"Enter a group name\" / \"already exists\" error; nothing saved.",
      },
      {
        scenario: "Delete guard",
        step: "1. Try to delete a group that still has members or assigned tickets",
        expected: "Redirected back with \"group still has members or assigned tickets\". Deletion succeeds only once both are cleared.",
      },
      {
        scenario: "List counts",
        step: "1. View the group list",
        expected: "Members and Tickets columns show correct counts; sorting by Members orders by membership count.",
      },
    ],
  },

  {
    name: "Master - Categories",
    description: "/master/category (admin) - ticket categories, the admins who own each (CategoryAdmin), the responsible user groups (CategoryUserGroup), active flag, and whether the category needs approval.",
    cases: [
      {
        scenario: "Create",
        step: "1. Create a category with a unique name\n2. Attach responsible groups and category admins",
        expected: "Category and its CategoryUserGroup / CategoryAdmin links are created. Duplicate / blank name is rejected.",
      },
      {
        scenario: "Edit links",
        step: "1. Edit a category and change its responsible groups",
        expected: "Old CategoryUserGroup rows are removed and the new set inserted; only active groups are selectable.",
      },
      {
        scenario: "New-ticket routing",
        step: "1. File a ticket under a category with responsible groups",
        expected: "The ticket is auto-assigned to those groups and notifications go to their active members.",
      },
      {
        scenario: "Active flag",
        step: "1. Deactivate a category",
        expected: "It no longer appears in the New Ticket category picker but existing tickets keep it.",
      },
    ],
  },

  {
    name: "Master - Companies",
    description: "/master/company (admin) - company records (code, name, address, taxId, active) with department and user counts.",
    cases: [
      {
        scenario: "Create / Edit",
        step: "1. Create a company with a unique code and a name\n2. Edit its address / taxId",
        expected: "Saved. Blank name is rejected; duplicate code is rejected.",
      },
      {
        scenario: "List",
        step: "1. View the company list",
        expected: "Department and user counts render; search by name works; sorting and paging preserve the query.",
      },
      {
        scenario: "Active flag",
        step: "1. Deactivate a company",
        expected: "It is excluded from company pickers used elsewhere but existing links remain.",
      },
    ],
  },

  {
    name: "Master - Departments",
    description: "Departments under a company, each with one or more approvers (DepartmentApprover). Replaces the old single supervisorId column. Delete is guarded when in use.",
    cases: [
      {
        scenario: "Create / Edit",
        step: "1. Create a department under a company\n2. Add two approvers",
        expected: "Department is saved with both DepartmentApprover rows. Name is unique per company.",
      },
      {
        scenario: "Approver routing",
        step: "1. Raise an approval-required ticket in that department",
        expected: "All department approvers see the request in their approval queue; any one can decide it.",
      },
      {
        scenario: "Delete guard",
        step: "1. Try to delete a department that has users or tickets",
        expected: "Blocked with an in-use message; allowed once empty.",
      },
    ],
  },

  {
    name: "Master - Lesson Learned",
    description: "/master/lesson-learned (admin) - reusable knowledge entries (title, rich-text description, images, attachments, active flag) surfaced to the AI assistant and referenced from tickets.",
    cases: [
      {
        scenario: "Create",
        step: "1. Create an entry with a title and description",
        expected: "Saved and listed. Blank title is rejected; a description that is only empty markup is rejected.",
      },
      {
        scenario: "Media",
        step: "1. Add images and file attachments to an entry",
        expected: "They are stored and shown on the view page.",
      },
      {
        scenario: "Active flag",
        step: "1. Deactivate an entry",
        expected: "It is excluded from active-only lookups (e.g. the assistant) but remains editable in Master.",
      },
      {
        scenario: "List",
        step: "1. Search and sort the list",
        expected: "Search matches title; sort/paging preserve the query.",
      },
    ],
  },

  {
    name: "Profile & API Tokens",
    description: "/profile - edit own name/telephone, self-service password change, and personal access tokens (used by the MCP server). Company/Department are read-only, set by an admin. Only a SHA-256 hash of each token is stored.",
    cases: [
      {
        scenario: "Edit profile",
        step: "1. Change name / telephone and save\n2. Submit with a blank name",
        expected: "Valid changes persist; a blank name is rejected. Company/Department are not editable here.",
      },
      {
        scenario: "Change password",
        step: "1. Enter the correct current password and a new password (>= 8 chars)\n2. Submit",
        expected: "Password is updated (bcrypt) and the next sign-in requires it. Wrong current password or a short new password is rejected.",
      },
      {
        scenario: "Create API token",
        step: "1. Create a token named e.g. \"MCP laptop\"",
        expected: "The raw token (hd_ + 48 hex) is shown ONCE. Only its hash is stored. A blank name is rejected.",
      },
      {
        scenario: "Use API token",
        step: "1. Call /api/mcp with Authorization: Bearer <token>",
        expected: "Resolves to the owning user. lastUsedAt is updated. An unknown or revoked token gets 401.",
      },
      {
        scenario: "Revoke API token",
        step: "1. Delete a token\n2. Retry the previous MCP call",
        expected: "The token row is removed and the call now returns 401. Other users' tokens are never listed or deletable.",
      },
    ],
  },

  {
    name: "Reports",
    description: "/transaction/report (Ticket / Assignee / Category) with date-range and other filters, on-screen charts (ApexCharts), and per-report Excel export. SLA time = first-assigned -> resolved, in days.",
    cases: [
      {
        scenario: "Filtering",
        step: "1. Set a date range and any report-specific filters\n2. Apply",
        expected: "Tables and charts refresh to the filtered data; the filter state is reflected in the URL.",
      },
      {
        scenario: "SLA calculation",
        step: "1. Inspect a resolved ticket's SLA time in the Ticket report",
        expected: "Equals (resolvedAt - firstAssignedAt) in days, one decimal, with a trailing \"d\"; unresolved shows an em dash.",
      },
      {
        scenario: "Status buckets",
        step: "1. Check the Assignee/Category report bucket breakdown",
        expected: "Active = NEW/ASSIGNED/REOPENED, Processing = WAITING, Done = RESOLVED/CLOSED.",
      },
      {
        scenario: "Export",
        step: "1. Click Export on each report with filters applied",
        expected: "The .xlsx matches the on-screen filtered data.",
      },
      {
        scenario: "Access",
        step: "1. Request a report route as a non-admin",
        expected: "Not permitted; redirected to the role home.",
      },
    ],
  },

  {
    name: "MCP API",
    description: "/api/mcp - Model Context Protocol endpoint for non-browser clients. Authenticates with a personal access token as Authorization: Bearer <token>; all tool calls run as that user with the same authorization rules as the web app.",
    cases: [
      {
        scenario: "Auth",
        step: "1. Call with no Authorization header\n2. Call with Authorization: Bearer bogus",
        expected: "Both return 401. No tool runs.",
      },
      {
        scenario: "Auth",
        step: "1. Call with a valid token for an ACTIVE user",
        expected: "Authenticated as that user; lastUsedAt updated; tools become available.",
      },
      {
        scenario: "Auth",
        step: "1. Call with a valid token whose user is INACTIVE/SUSPENDED",
        expected: "Rejected (401) - status is re-checked, not just token validity.",
      },
      {
        scenario: "Authorization parity",
        step: "1. As a USER token, use a tool to read a ticket owned by someone else",
        expected: "Same visibility rules as the web app - access denied / not found.",
      },
    ],
  },

  {
    name: "AI Chat (feature-flagged)",
    description: "/chat and /api/chat - streaming assistant that can look up Lesson Learned entries. Gated by CHAT_ENABLED in app/lib/feature-flags.ts (currently false).",
    cases: [
      {
        scenario: "Flag off",
        step: "1. With CHAT_ENABLED = false, open /chat and hit /api/chat",
        expected: "The Chat nav item is hidden and the route is unavailable.",
      },
      {
        scenario: "Flag on - streaming",
        step: "1. Enable the flag\n2. Ask a question in /chat",
        expected: "The reply streams token-by-token; no full-page reload.",
      },
      {
        scenario: "Flag on - lesson lookup",
        step: "1. Ask about a known problem that has a Lesson Learned entry",
        expected: "The answer references the entry and links to it; inactive entries are not used.",
      },
      {
        scenario: "Provider failure",
        step: "1. Simulate the upstream model returning no content",
        expected: "A graceful \"unreachable\" style message is shown rather than a crash.",
      },
    ],
  },
];
