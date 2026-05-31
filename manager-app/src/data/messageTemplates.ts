import type { TemplateCategory } from '../types';

export interface DefaultTemplate {
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
}

/**
 * Starter templates the owner can load into the message_templates table and edit.
 * Bodies use {{placeholders}} that fillTemplate() substitutes from a party profile.
 */
export const DEFAULT_MESSAGE_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Initial follow-up',
    category: 'follow_up',
    subject: "Following up on your event at Iggy's",
    body: `Hi {{first_name}},

Thank you so much for your interest in hosting your event at {{venue_name}}! I wanted to follow up and see if you had any questions, or if there's anything I can put together to help you plan.

Whenever you have a moment, just let me know your preferred date, an estimated headcount, and the vibe you're going for, and I'll get everything lined up on our end.

Looking forward to hosting you!

Best regards,
{{manager_name}}
{{venue_name}}`,
  },
  {
    name: 'Event confirmation (recap)',
    category: 'confirmation',
    subject: "Your event at Iggy's — {{event_date}}",
    body: `Hi {{first_name}},

It was a pleasure speaking with you today! Thank you for providing those details. Below is a recap of our conversation to share with your team:

Event Details:
  - Date: {{event_date}}
  - Time: {{start_time}} – {{end_time}} (start setting up at {{setup_time}})
  - Rental Space: {{room_rate}}/hr, rounded to {{room_hours}} hours — {{room_total}} total
  - Food Service: {{food_service_type}}. If you'd like a limited menu for your event, just let us know and we'll print one out. We can also put out appetizers on arrival if you'd like. There is a {{gratuity_pct}} gratuity added to the food and beverage total.
  - Drinks: We have a satellite bar upstairs where we can make basic cocktails. If you'd like a couple of special cocktails, take a look at our menu and pick 1 or 2 and we'll have the ingredients prepared upstairs. There's a keg cooler upstairs with 4 different beers (we try to do an IPA, Lager, Hef, and possibly another IPA). Red, White and Rosé wines are available. We also have non-alcoholic beer and wine upstairs, plus soda and water.

This will be our event email to continue our communication. It keeps everything in one place and is very easy to find. Please don't hesitate to reach out and let me know if you need anything else or have a change of plans!

Best regards,
{{manager_name}}
{{venue_name}}`,
  },
  {
    name: 'Cancellation acknowledgement',
    category: 'cancellation',
    subject: "Your event at Iggy's",
    body: `Hi {{first_name}},

Thank you for letting us know. We've cancelled the hold for your event — no problem at all, and we completely understand that plans change.

We'd love to host you down the road, so please keep us in mind for your next gathering. Whenever you're ready, just reach out and we'll get everything set back up.

All the best,
{{manager_name}}
{{venue_name}}`,
  },
];
