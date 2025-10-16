import reecherLogo from '@/assets/reecher_logo.svg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
  xl: 'h-12',
};

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizeClass = sizeMap[size];

  return (
    <img
      src={reecherLogo}
      alt="Reecher - מערכת לשליחת הודעות וואטסאפ"
      className={`${sizeClass} w-auto ${className}`}
    />
  );
}
