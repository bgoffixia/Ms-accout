type PortalWordmarkProps = {
  inverse?: boolean;
  className?: string;
};

export function PortalWordmark({ inverse = false, className = '' }: PortalWordmarkProps) {
  return (
    <div className={`portal-wordmark ${inverse ? 'portal-wordmark-inverse' : ''} ${className}`} aria-label="M-soft Account Protection Bank Grade Security System">
      <span className="portal-wordmark-primary">M-soft Account Protection</span>
      <span className="portal-wordmark-secondary">Bank Grade Security System</span>
    </div>
  );
}
