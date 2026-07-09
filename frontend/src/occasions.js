import {
  RingsIcon, CakeIcon, FlowerIcon, SunriseIcon, BottleIcon, UsersIcon, StarIcon,
} from './components/icons.jsx';

export const OCCASIONS = ['Wedding', 'Birthday', 'Funeral', 'Retirement', 'Baby Shower', 'Reunion', 'Other'];

const OCCASION_ICONS = {
  Wedding: RingsIcon,
  Birthday: CakeIcon,
  Funeral: FlowerIcon,
  Retirement: SunriseIcon,
  'Baby Shower': BottleIcon,
  Reunion: UsersIcon,
  Other: StarIcon,
};

export function occasionIcon(occasion) {
  return OCCASION_ICONS[occasion] || StarIcon;
}
