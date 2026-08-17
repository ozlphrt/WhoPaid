import { ExpenseCategory } from '../types';

export const CATEGORIES: { id: ExpenseCategory; label: string; iconName: string; emoji: string }[] = [
  { id: 'Food', label: 'Food', iconName: 'UtensilsCrossed', emoji: '🍽️' },
  { id: 'Drinks', label: 'Drinks', iconName: 'Wine', emoji: '🍸' },
  { id: 'Transport', label: 'Transport', iconName: 'Car', emoji: '🚗' },
  { id: 'Hotel', label: 'Hotel', iconName: 'BedDouble', emoji: '🏨' },
  { id: 'Tickets', label: 'Tickets', iconName: 'Ticket', emoji: '🎟️' },
  { id: 'Other', label: 'Other', iconName: 'Layers', emoji: '📦' }
];

export function suggestCategory(description: string): ExpenseCategory {
  const text = description.toLowerCase().trim();

  // Food
  if (/dinner|lunch|breakfast|food|restaurant|cafe|bakery|snack|pizza|burger|sushi|pasta|grocer|market|supermarket|meal|taverna|kebab|dessert|ice cream|brunch/.test(text)) {
    return 'Food';
  }

  // Drinks
  if (/drink|bar|beer|wine|cocktail|pub|coffee|espresso|latte|tea|club|beverage|vodka|gin|shots/.test(text)) {
    return 'Drinks';
  }

  // Transport
  if (/taxi|uber|lyft|cab|gas|petrol|fuel|bus|train|metro|ferry|toll|parking|flight|airline|car rental|scooter|bike|subway|transit/.test(text)) {
    return 'Transport';
  }

  // Hotel
  if (/hotel|airbnb|booking|hostel|resort|room|stay|villa|apartment|motel|lodging/.test(text)) {
    return 'Hotel';
  }

  // Tickets
  if (/ticket|museum|entry|tour|show|concert|cinema|movie|exhibition|pass|attraction|event|ferry ticket|entrance/.test(text)) {
    return 'Tickets';
  }

  return 'Food';
}
