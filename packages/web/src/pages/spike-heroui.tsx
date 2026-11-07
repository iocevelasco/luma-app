import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Home, Receipt, Wallet } from 'lucide-react';
import { z } from 'zod';
import {
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  Tabs,
  TextField,
  Toast,
  toast,
} from '@heroui/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import '@/styles/heroui-spike.css';

/**
 * SPIKE: componentes de HeroUI v3 con los tokens de Luma, sin tocar el resto de
 * la app. Sólo existe en desarrollo (ver `routes.tsx`). Si el spike no sigue,
 * se borra esta página, `styles/heroui-spike.css` y las claves `spikeHeroui`.
 */

const CURRENCIES = ['USD', 'EUR', 'VES'] as const;

type FormValues = { name: string; currency: string | null };

export function SpikeHeroUiPage() {
  const { t } = useTranslation();

  // Igual que DashboardLayout: Modal, Select y Tooltip salen por portal al <body>.
  useEffect(() => {
    document.body.classList.add('surface-light');
    return () => document.body.classList.remove('surface-light');
  }, []);

  const schema = z.object({
    name: z.string().min(3, t('spikeHeroui.nameTooShort')),
    // `null` es el "sin elegir" de HeroUI: zod lo trata como tipo inválido, no como falta.
    currency: z
      .string({ invalid_type_error: t('spikeHeroui.currencyRequired') })
      .min(1, t('spikeHeroui.currencyRequired')),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', currency: null },
  });

  const onSubmit = () => {
    toast.success(t('spikeHeroui.saved'));
    form.reset();
  };

  const projects = [
    { id: 'north', label: t('spikeHeroui.projectNorth') },
    { id: 'south', label: t('spikeHeroui.projectSouth') },
  ];
  const rows = [
    { id: 'cement', concept: t('spikeHeroui.rowCement'), paid: true, amount: '1.240,00' },
    { id: 'sand', concept: t('spikeHeroui.rowSand'), paid: false, amount: '380,50' },
    { id: 'rebar', concept: t('spikeHeroui.rowRebar'), paid: true, amount: '2.915,00' },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Toast.Provider />

      {/* Chrome oscuro: lo que en el panel es header + sidebar. */}
      <header className="surface-dark flex items-center gap-4 bg-background px-6 py-3 text-foreground">
        <span className="text-sm text-muted">{t('spikeHeroui.chromeTitle')}</span>
        <Select className="w-52" placeholder={t('spikeHeroui.projectLabel')} aria-label={t('spikeHeroui.projectLabel')}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {projects.map((p) => (
                <ListBox.Item key={p.id} id={p.id} textValue={p.label}>
                  {p.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button variant="ghost" size="sm" className="ml-auto">
          {t('spikeHeroui.details')}
        </Button>
      </header>

      <div className="flex flex-1">
        <nav className="surface-dark flex w-48 flex-col gap-1 bg-background p-3 text-foreground" aria-label={t('spikeHeroui.chromeTitle')}>
          <Button variant="tertiary" className="justify-start">
            <Home aria-hidden size={16} />
            {t('spikeHeroui.navHome')}
          </Button>
          <Button variant="ghost" className="justify-start">
            <Receipt aria-hidden size={16} />
            {t('spikeHeroui.navExpenses')}
          </Button>
        </nav>

        <main className="flex-1 bg-background p-8 text-foreground">
          <div className="mx-auto flex max-w-3xl flex-col gap-8">
            <header className="flex flex-col gap-2">
              <h1 className="font-serif text-3xl">{t('spikeHeroui.title')}</h1>
              <p className="text-muted">{t('spikeHeroui.intro')}</p>
            </header>

            <section aria-label={t('spikeHeroui.buttons')} className="flex flex-wrap gap-3">
              <Button variant="primary">{t('spikeHeroui.save')}</Button>
              <Button variant="secondary">{t('spikeHeroui.cancel')}</Button>
              <Button variant="outline">{t('spikeHeroui.export')}</Button>
              <Button variant="ghost">{t('spikeHeroui.details')}</Button>
              <Button variant="danger">{t('spikeHeroui.delete')}</Button>
              <Button variant="secondary" onPress={() => toast.success(t('spikeHeroui.saved'))}>
                {t('spikeHeroui.showToast')}
              </Button>
            </section>

            <Tabs>
              <Tabs.ListContainer>
                <Tabs.List aria-label={t('spikeHeroui.tabsLabel')}>
                  <Tabs.Tab id="summary">
                    <Home aria-hidden size={14} />
                    {t('spikeHeroui.tabSummary')}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="expenses">
                    <Receipt aria-hidden size={14} />
                    {t('spikeHeroui.tabExpenses')}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="payments">
                    <Wallet aria-hidden size={14} />
                    {t('spikeHeroui.tabPayments')}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id="summary" className="pt-4">
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={t('spikeHeroui.tableLabel')}>
                      <Table.Header>
                        <Table.Column isRowHeader id="concept">
                          {t('spikeHeroui.colConcept')}
                        </Table.Column>
                        <Table.Column id="status">{t('spikeHeroui.colStatus')}</Table.Column>
                        <Table.Column id="amount">{t('spikeHeroui.colAmount')}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {rows.map((r) => (
                          <Table.Row key={r.id} id={r.id}>
                            <Table.Cell>{r.concept}</Table.Cell>
                            <Table.Cell>
                              <Chip color={r.paid ? 'success' : 'warning'} variant="soft">
                                {r.paid ? t('spikeHeroui.statusPaid') : t('spikeHeroui.statusPending')}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell>{r.amount}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Tabs.Panel>
              <Tabs.Panel id="expenses" className="pt-4">
                {t('spikeHeroui.tabExpenses')}
              </Tabs.Panel>
              <Tabs.Panel id="payments" className="pt-4">
                {t('spikeHeroui.tabPayments')}
              </Tabs.Panel>
            </Tabs>

            <Card>
              <Card.Header>
                <Card.Title>{t('spikeHeroui.formTitle')}</Card.Title>
              </Card.Header>
              <Card.Content>
                <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                  <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        isInvalid={fieldState.invalid}
                      >
                        <Label>{t('spikeHeroui.fieldLabel')}</Label>
                        <Input ref={field.ref} placeholder={t('spikeHeroui.fieldPlaceholder')} />
                        <Description>{t('spikeHeroui.fieldHint')}</Description>
                        <FieldError>{fieldState.error?.message}</FieldError>
                      </TextField>
                    )}
                  />
                  <Controller
                    name="currency"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Select
                        placeholder={t('spikeHeroui.currencyPlaceholder')}
                        value={field.value}
                        onChange={(key) => field.onChange(key as string | null)}
                        onBlur={field.onBlur}
                        isInvalid={fieldState.invalid}
                      >
                        <Label>{t('spikeHeroui.currencyLabel')}</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <FieldError>{fieldState.error?.message}</FieldError>
                        <Select.Popover>
                          <ListBox>
                            {CURRENCIES.map((c) => (
                              <ListBox.Item key={c} id={c} textValue={c}>
                                {t(`spikeHeroui.currency${c[0]}${c.slice(1).toLowerCase()}`)}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    )}
                  />
                  <div>
                    <Button type="submit" variant="primary">
                      {t('spikeHeroui.save')}
                    </Button>
                  </div>
                </form>
              </Card.Content>
            </Card>

            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback>{t('spikeHeroui.projectLabel')[0]}</AvatarFallback>
                </Avatar>
                <Spinner />
                <Skeleton className="h-4 w-32" />
              </div>
              <Separator />
              <Progress value={60} />
            </section>

            <Modal>
              <Button variant="secondary">{t('spikeHeroui.openDialog')}</Button>
              <Modal.Backdrop>
                <Modal.Container>
                  <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                      <Modal.Heading>{t('spikeHeroui.dialogTitle')}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                      <p>{t('spikeHeroui.dialogBody')}</p>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button slot="close" variant="secondary">
                        {t('spikeHeroui.cancel')}
                      </Button>
                      <Button slot="close" variant="danger">
                        {t('spikeHeroui.delete')}
                      </Button>
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
          </div>
        </main>
      </div>
    </div>
  );
}
