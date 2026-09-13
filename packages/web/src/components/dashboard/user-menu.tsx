import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/hooks/auth/use-auth-queries';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';

export function UserMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const logout = useLogout();
  const { resolvedTheme, setTheme } = useTheme();

  const initials = (user?.name ?? user?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="size-8">
            {user?.picture && <AvatarImage src={user.picture} alt="" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{user?.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to={ROUTES.ACCOUNT_SETTINGS}>
            <User className="size-4" />
            {t('userMenu.account')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {t('userMenu.theme')}
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to={ROUTES.ACCOUNT_SETTINGS}>
            <Settings className="size-4" />
            {t('userMenu.settings')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut className="size-4" />
          {t('userMenu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
