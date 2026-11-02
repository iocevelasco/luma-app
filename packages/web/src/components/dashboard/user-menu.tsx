import { CreditCard, Landmark, LogOut, MessageSquareHeart, Settings, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';
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
import { useDeletedProjects } from '@/hooks/projects/use-project-queries';
import { isAdmin } from '@/lib/roles';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';

export function UserMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const logout = useLogout();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { data: trash } = useDeletedProjects();

  const initials = (user?.name ?? user?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
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

        <DropdownMenuItem asChild>
          <Link to={ROUTES.ACCOUNT_SETTINGS}>
            <Settings className="size-4" />
            {t('userMenu.settings')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to={ROUTES.SUBSCRIPTION} data-testid="user-menu-subscription">
            <CreditCard className="size-4" />
            {t('userMenu.subscription')}
          </Link>
        </DropdownMenuItem>

        {/* Sólo aparece si hay algo adentro: una papelera vacía no es un destino. */}
        {trash && trash.projects.length > 0 && (
          <DropdownMenuItem asChild>
            <Link to={ROUTES.PROJECTS_TRASH} data-testid="user-menu-trash">
              <Trash2 className="size-4" />
              {t('project.trash.link', { count: trash.projects.length })}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onSelect={() => setFeedbackOpen(true)} data-testid="user-menu-feedback">
          <MessageSquareHeart className="size-4" />
          {t('userMenu.feedback')}
        </DropdownMenuItem>

        {isAdmin(user?.role) && (
          <DropdownMenuItem asChild>
            <Link to={ROUTES.PLATFORM}>
              <Landmark className="size-4" />
              {t('userMenu.platform')}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut className="size-4" />
          {t('userMenu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
