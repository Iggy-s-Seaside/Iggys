export interface AppTool { to: string; title: string; description: string; ownerOnly?: boolean }
export interface ToolGroup { id: string; title: string; description: string; tools: AppTool[] }

/** Task names, not internal feature names. Every operational route stays reachable. */
export const TOOL_GROUPS: ToolGroup[] = [
  { id: 'bar', title: 'Staff & daily tasks', description: 'Staff schedules, guests and event preparation.', tools: [
    { to: '/waitlist', title: 'Seat guests', description: 'Manage the waitlist and notify waiting guests.' },
    { to: '/schedule', title: 'Staff schedule', description: 'See who is working and update shifts.' },
    { to: '/todos', title: 'Jobs to do', description: 'Assign and finish tasks.' },
    { to: '/run-sheet', title: 'Today’s event instructions', description: 'Times, spaces and what the team needs to prepare.' },
  ] },
  { id: 'bookings', title: 'Bookings & events', description: 'Private parties, music nights and event paperwork.', tools: [
    { to: '/parties', title: 'Private bookings', description: 'Follow up on requests and manage confirmed parties.' },
    { to: '/events', title: 'Public events', description: 'Add or stop DJ nights and live music on the website.' },
    { to: '/calendar', title: 'Calendar', description: 'See what is booked and what is coming up.' },
    { to: '/pipeline', title: 'Follow up on bookings', description: 'See which requests need a decision or payment.' },
    { to: '/packages', title: 'Booking prices & packages', description: 'Update what guests can book.' },
    { to: '/invoices', title: 'Invoices & payments', description: 'Prepare invoices and check payments.' },
  ] },
  { id: 'stock', title: 'Stock & menu', description: 'What is available, what to order and what it costs.', tools: [
    { to: '/inventory', title: 'Stock & ordering', description: 'Check supplies and mark items low or out.' },
    { to: '/inventory/count', title: 'Count stock', description: 'Record what is on hand.' },
    { to: '/menu', title: 'Update the menu', description: 'Change existing items, prices and availability.' },
    { to: '/cogs', title: 'Costs & margins', description: 'Review product costs and selling prices.' },
    { to: '/merch', title: 'Shirts & merchandise', description: 'Manage sizes, prices and stock.' },
  ] },
  { id: 'customers', title: 'Customers & publicity', description: 'Messages, reviews and approved posts.', tools: [
    { to: '/messages', title: 'Inbox', description: 'Read enquiries and reply to guests.' },
    { to: '/reputation', title: 'Customer reviews', description: 'Read reviews and prepare a response.' },
    { to: '/social', title: 'Social posts', description: 'Share an existing event or approved offering.' },
    { to: '/marketing', title: 'Campaigns', description: 'Manage planned outreach.' },
    { to: '/media', title: 'Photos & files', description: 'Find and upload images.' },
    { to: '/specials', title: 'Drink promotions & artwork', description: 'Manage approved promotions when you choose to.' },
  ] },
  { id: 'business', title: 'Business & settings', description: 'Reports, reminders, access and safety records.', tools: [
    { to: '/notifications', title: 'Event reminders', description: 'See reminders and turn on phone notifications.' },
    { to: '/reports', title: 'Business reports', description: 'Review sales and end-of-night records.' },
    { to: '/team', title: 'Staff & access', description: 'Manage staff and who can use the app.', ownerOnly: true },
    { to: '/compliance', title: 'Licences & safety', description: 'Keep track of required records.' },
    { to: '/help', title: 'Help using the app', description: 'Plain instructions for common tasks.' },
  ] },
  { id: 'assistant', title: 'Ask about the bar', description: 'Get help with a specific question.', tools: [
    { to: '/luna', title: 'Ask Luna', description: 'Ask about a booking, stock or the night ahead.' },
    { to: '/luna/room', title: 'Bar observations', description: 'See recent notes and observations.' },
  ] },
];

export function findTool(pathname: string): AppTool | undefined {
  return TOOL_GROUPS.flatMap((g) => g.tools).filter((t) => pathname === t.to || pathname.startsWith(t.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0];
}
