import { useState } from 'react';
import { format } from 'date-fns';
import { MailCheck, MoreHorizontal, Send, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Campaign, CampaignStatus } from '@luma/shared';
import { RowCard, RowCardBody, RowCardEnd } from '@/components/common/row-card-list';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useCampaignAudience,
  useDeleteCampaign,
  useSendCampaign,
  useSendCampaignTest,
} from '@/hooks/platform/use-platform-campaigns-queries';
import { useDateLocale } from '@/hooks/use-date-locale';

const STATUS_VARIANT: Record<CampaignStatus, 'neutral' | 'warning' | 'success'> = {
  draft: 'neutral',
  sending: 'warning',
  sent: 'success',
};

/**
 * Una campaña, como fila. Un borrador tiene el paso siguiente a la vista
 * (enviar) y el resto en "…"; lo ya enviado queda de registro, sin acciones.
 */
export function CampaignRowCard({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const audience = useCampaignAudience();
  const sendTest = useSendCampaignTest();
  const send = useSendCampaign();
  const remove = useDeleteCampaign();
  const [confirming, setConfirming] = useState<'send' | 'delete' | null>(null);

  const isDraft = campaign.status === 'draft';
  const progress =
    campaign.status === 'draft'
      ? null
      : t('platform.campaigns.progress', {
          sent: campaign.sent,
          total: campaign.recipients,
          failed: campaign.failed,
        });

  return (
    <>
      <RowCard>
        <RowCardBody
          title={<span className="truncate">{campaign.title}</span>}
          meta={
            <span className="block truncate">
              {[format(new Date(campaign.createdAt), 'PP', { locale }), progress]
                .filter(Boolean)
                .join(' · ')}
            </span>
          }
        />
        <RowCardEnd>
          <Badge variant={STATUS_VARIANT[campaign.status]}>
            {t(`platform.campaigns.status.${campaign.status}`)}
          </Badge>
          {isDraft && (
            <>
              <Button size="sm" onClick={() => setConfirming('send')} disabled={send.isPending}>
                <Send className="size-4" />
                {t('platform.campaigns.send')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t('platform.campaigns.moreActions')}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => sendTest.mutate(campaign.id)}>
                    <MailCheck className="size-4" />
                    {t('platform.campaigns.sendTest')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setConfirming('delete')}>
                    <Trash2 className="size-4" />
                    {t('platform.campaigns.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </RowCardEnd>
      </RowCard>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(confirming === 'delete' ? 'platform.campaigns.deleteTitle' : 'platform.campaigns.sendTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === 'delete'
                ? t('platform.campaigns.deleteBody', { title: campaign.title })
                : t('platform.campaigns.sendBody', { count: audience.data?.recipients ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming === 'delete') remove.mutate(campaign.id);
                else send.mutate(campaign.id);
                setConfirming(null);
              }}
            >
              {t(confirming === 'delete' ? 'platform.campaigns.delete' : 'platform.campaigns.send')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
