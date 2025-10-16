import reecherLogoDark from '@/assets/reecher_logo_dark.png';
import reecherIconLight from '@/assets/reecher_icon_light.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'dark' | 'light';
  type?: 'full' | 'icon';
  className?: string;
}

const sizeMap = {
  sm: 'h-[20px]',
  md: 'h-[24px]',
  lg: 'h-[26px]',
  xl: 'h-[26px]',
};

export function Logo({ 
  size = 'md', 
  variant = 'dark',
  type,
  className = '' 
}: LogoProps) {
  const sizeClass = sizeMap[size];
  
  // Use icon for light variant OR if explicitly requested
  const useIcon = variant === 'light' || type === 'icon';
  const logoSrc = useIcon ? reecherIconLight : reecherLogoDark;
  const altText = useIcon 
    ? "Reecher" 
    : "Reecher - מערכת לשליחת הודעות וואטסאפ";

  return (
    <img
      src={logoSrc}
      alt={altText}
      className={`${sizeClass} w-auto ${className}`}
    />
  );
}
