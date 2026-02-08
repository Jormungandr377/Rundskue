import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Pencil,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  Circle,
  SplitSquareHorizontal,
  X,
  UserPlus,
} from 'lucide-react'
import { format } from 'date-fns'
import authenticatedApi from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { formatCurrency } from '../utils/format'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Participant {
  id: number
  name: string
  email?: string
  share_amount: number
  is_paid: boolean
}

interface Split {
  id: number
  description: string
  total_amount: number
  date: string
  participants: Participant[]
  created_at: string
}

interface Balance {
  name: string
  email?: string
  amount: number // positive = they owe you, negative = you owe them
}

interface ParticipantInput {
  name: string
  email: string
  share_amount: string
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const splitsApi = {
  list: () =>
    authenticatedApi.get<Split[]>('/splits').then((r) => r.data),
  create: (data: { description: string; total_amount: number; date: string; participants: { name: string; email?: string; share_amount: number }[] }) =>
    authenticatedApi.post<Split>('/splits', data).then((r) => r.data),
  createEqual: (data: { description: string; total_amount: number; date: string; participants: { name: string; email?: string }[] }) =>
    authenticatedApi.post<Split>('/splits/split-equally', data).then((r) => r.data),
  delete: (id: number) =>
    authenticatedApi.delete(`/splits/${id}`),
  markPaid: (splitId: number, participantId: number) =>
    authenticatedApi.put(`/splits/${splitId}/participants/${participantId}/paid`),
  balances: () =>
    authenticatedApi.get<Balance[]>('/splits/balances').then((r) => r.data),
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BillSplitting() {
  const queryClient = useQueryClient()
  const { addToast } = useToast()

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [editingSplit, setEditingSplit] = useState<Split | null>(null)

  // Form state
  const emptyParticipant: ParticipantInput = { name: '', email: '', share_amount: '' }
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [participants, setParticipants] = useState<ParticipantInput[]>([
    { ...emptyParticipant },
    { ...emptyParticipant },
  ])
  const [splitEqually, setSplitEqually] = useState(true)

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  const { data: splits = [], isLoading: splitsLoading } = useQuery({
    queryKey: ['splits'],
    queryFn: splitsApi.list,
  })

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ['splits', 'balances'],
    queryFn: splitsApi.balances,
  })

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof splitsApi.create>[0]) => splitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splits'] })
      resetForm()
      addToast('Split created successfully', 'success')
    },
    onError: () => addToast('Failed to create split', 'error'),
  })

  const createEqualMutation = useMutation({
    mutationFn: (data: Parameters<typeof splitsApi.createEqual>[0]) => splitsApi.createEqual(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splits'] })
      resetForm()
      addToast('Split created successfully', 'success')
    },
    onError: () => addToast('Failed to create split', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => splitsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splits'] })
      addToast('Split deleted', 'success')
    },
    onError: () => addToast('Failed to delete split', 'error'),
  })

  const markPaidMutation = useMutation({
    mutationFn: ({ splitId, participantId }: { splitId: number; participantId: number }) =>
      splitsApi.markPaid(splitId, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splits'] })
      addToast('Marked as paid', 'success')
    },
    onError: () => addToast('Failed to update status', 'error'),
  })

  // -----------------------------------------------------------------------
  // Form helpers
  // -----------------------------------------------------------------------

  function resetForm() {
    setShowForm(false)
    setEditingSplit(null)
    setDescription('')
    setTotalAmount('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setParticipants([{ ...emptyParticipant }, { ...emptyParticipant }])
    setSplitEqually(true)
  }

  function openNewForm() {
    resetForm()
    setShowForm(true)
  }

  function addParticipant() {
    setParticipants([...participants, { ...emptyParticipant }])
  }

  function removeParticipant(index: number) {
    if (participants.length <= 2) return
    setParticipants(participants.filter((_, i) => i !== index))
  }

  function updateParticipant(index: number, field: keyof ParticipantInput, value: string) {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    setParticipants(updated)
  }

  // Compute equal shares when toggle is on
  const parsedTotal = parseFloat(totalAmount) || 0
  const validParticipants = participants.filter((p) => p.name.trim() !== '')
  const equalShare = validParticipants.length > 0 ? parsedTotal / validParticipants.length : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (validParticipants.length < 2) {
      addToast('At least two participants are required', 'warning')
      return
    }

    if (parsedTotal <= 0) {
      addToast('Total amount must be greater than zero', 'warning')
      return
    }

    if (splitEqually) {
      createEqualMutation.mutate({
        description,
        total_amount: parsedTotal,
        date,
        participants: validParticipants.map((p) => ({
          name: p.name.trim(),
          email: p.email.trim() || undefined,
        })),
      })
    } else {
      // Validate custom shares add up
      const shareSum = validParticipants.reduce((s, p) => s + (parseFloat(p.share_amount) || 0), 0)
      if (Math.abs(shareSum - parsedTotal) > 0.01) {
        addToast(`Shares total ${formatCurrency(shareSum)} but bill is ${formatCurrency(parsedTotal)}`, 'warning')
        return
      }

      createMutation.mutate({
        description,
        total_amount: parsedTotal,
        date,
        participants: validParticipants.map((p) => ({
          name: p.name.trim(),
          email: p.email.trim() || undefined,
          share_amount: parseFloat(p.share_amount) || 0,
        })),
      })
    }
  }

  function loadSplitForEdit(split: Split) {
    setEditingSplit(split)
    setDescription(split.description)
    setTotalAmount(String(split.total_amount))
    setDate(split.date)
    setSplitEqually(false)
    setParticipants(
      split.participants.map((p) => ({
        name: p.name,
        email: p.email || '',
        share_amount: String(p.share_amount),
      }))
    )
    setShowForm(true)
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (splitsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  const isPending = createMutation.isPending || createEqualMutation.isPending

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Bill Splitting</h1>
          <p className="text-stone-500 dark:text-stone-400">
            Split expenses and track who owes what
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Split
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Balance Summary Cards                                             */}
      {/* ----------------------------------------------------------------- */}
      {!balancesLoading && balances.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Balances
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map((balance) => {
              const owesYou = balance.amount > 0
              return (
                <div key={balance.name} className="card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-stone-900 dark:text-white">{balance.name}</p>
                      {balance.email && (
                        <p className="text-xs text-stone-400 dark:text-stone-500">{balance.email}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          owesYou
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatCurrency(Math.abs(balance.amount))}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {owesYou ? 'owes you' : 'you owe'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* New / Edit Split Form                                             */}
      {/* ----------------------------------------------------------------- */}
      {showForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
              {editingSplit ? 'Edit Split' : 'Create New Split'}
            </h3>
            <button
              onClick={resetForm}
              className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Bill info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Dinner at Mario's"
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Total Amount
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                />
              </div>
            </div>

            {/* Split equally toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={splitEqually}
                onClick={() => setSplitEqually(!splitEqually)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  splitEqually ? 'bg-teal-600' : 'bg-stone-300 dark:bg-stone-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    splitEqually ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Split Equally
              </span>
              {splitEqually && parsedTotal > 0 && validParticipants.length > 0 && (
                <span className="text-sm text-teal-600 dark:text-teal-400">
                  ({formatCurrency(equalShare)} each)
                </span>
              )}
            </div>

            {/* Participants */}
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                Participants
              </label>
              <div className="space-y-3">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        required
                        value={p.name}
                        onChange={(e) => updateParticipant(i, 'name', e.target.value)}
                        placeholder="Name"
                        className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                      />
                      <input
                        type="email"
                        value={p.email}
                        onChange={(e) => updateParticipant(i, 'email', e.target.value)}
                        placeholder="Email (optional)"
                        className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                      />
                      {splitEqually ? (
                        <div className="flex items-center px-3 py-2 bg-stone-50 dark:bg-stone-600 border border-stone-200 dark:border-stone-600 rounded-lg text-stone-500 dark:text-stone-300 text-sm">
                          {parsedTotal > 0 && p.name.trim()
                            ? formatCurrency(equalShare)
                            : '--'}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.share_amount}
                          onChange={(e) => updateParticipant(i, 'share_amount', e.target.value)}
                          placeholder="Share amount"
                          className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeParticipant(i)}
                      disabled={participants.length <= 2}
                      className="mt-2 p-1 text-stone-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Remove participant ${i + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addParticipant}
                className="mt-3 flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Participant
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Creating...' : editingSplit ? 'Update Split' : 'Create Split'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-600 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Split History                                                     */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h2 className="text-lg font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
          <SplitSquareHorizontal className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          Split History
        </h2>

        {splits.length === 0 ? (
          <div className="card p-6">
            <div className="text-center py-8">
              <SplitSquareHorizontal className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
              <p className="text-stone-500 dark:text-stone-400">No splits yet</p>
              <p className="text-sm text-stone-400 dark:text-stone-500">
                Create your first split to start tracking shared expenses
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {splits.map((split) => {
              const paidCount = split.participants.filter((p) => p.is_paid).length
              const allPaid = paidCount === split.participants.length

              return (
                <div key={split.id} className="card p-6">
                  {/* Split header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-stone-900 dark:text-white text-lg">
                        {split.description}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-stone-500 dark:text-stone-400">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          {formatCurrency(split.total_amount)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(split.date), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {split.participants.length} people
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {allPaid && (
                        <span className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-medium">
                          Settled
                        </span>
                      )}
                      <button
                        onClick={() => loadSplitForEdit(split)}
                        className="p-1.5 text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors"
                        aria-label={`Edit split ${split.description}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(split.id)}
                        className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        aria-label={`Delete split ${split.description}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Participants list */}
                  <div className="divide-y divide-stone-100 dark:divide-stone-700">
                    {split.participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              !participant.is_paid &&
                              markPaidMutation.mutate({
                                splitId: split.id,
                                participantId: participant.id,
                              })
                            }
                            disabled={participant.is_paid || markPaidMutation.isPending}
                            className={`transition-colors ${
                              participant.is_paid
                                ? 'text-emerald-500 cursor-default'
                                : 'text-stone-300 dark:text-stone-600 hover:text-teal-500 dark:hover:text-teal-400 cursor-pointer'
                            }`}
                            aria-label={
                              participant.is_paid
                                ? `${participant.name} has paid`
                                : `Mark ${participant.name} as paid`
                            }
                          >
                            {participant.is_paid ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                          <div>
                            <p
                              className={`font-medium ${
                                participant.is_paid
                                  ? 'text-stone-400 dark:text-stone-500 line-through'
                                  : 'text-stone-900 dark:text-white'
                              }`}
                            >
                              {participant.name}
                            </p>
                            {participant.email && (
                              <p className="text-xs text-stone-400 dark:text-stone-500">
                                {participant.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-semibold ${
                              participant.is_paid
                                ? 'text-stone-400 dark:text-stone-500'
                                : 'text-stone-900 dark:text-white'
                            }`}
                          >
                            {formatCurrency(participant.share_amount)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              participant.is_paid
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {participant.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
                      <span>
                        {paidCount} of {split.participants.length} paid
                      </span>
                      <span>
                        {Math.round((paidCount / split.participants.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-teal-600 dark:bg-teal-500 transition-all duration-300"
                        style={{
                          width: `${(paidCount / split.participants.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
