import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useDeleteFood, useTheatreFood, useUpdateFood } from '../../api/ownerFood.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import VegMark from '../../components/ui/VegMark.jsx'
import { formatRupees } from '../../validation/food.js'
import { THEATRE_STATUS_LABELS, THEATRE_STATUS_TONES } from '../../validation/theatres.js'

// O-07: the canteen items of one of my theatres (UI-30 register look)
const cell = 'border border-ink px-3 py-2 align-top dark:border-cream-light'

export default function OwnerFoodPage() {
  const { id } = useParams()
  const location = useLocation()
  const food = useTheatreFood(id)
  const update = useUpdateFood()
  const remove = useDeleteFood()
  const [confirmId, setConfirmId] = useState(null) // the row that asks "Delete?"
  const [message, setMessage] = useState(location.state?.message ?? null)
  const theatre = food.data?.theatre

  const actionError = update.error ?? remove.error

  function toggleStock(item) {
    setMessage(null)
    update.mutate({ id: item.id, body: { inStock: !item.inStock } })
  }

  function doDelete(item) {
    remove.mutate(item.id, {
      onSuccess: () => {
        setConfirmId(null)
        setMessage(`"${item.name}" deleted.`)
      },
    })
  }

  return (
    <div className="space-y-6">
      <p>
        <Link to="/owner/theatres" className="font-type underline">
          ← My theatres
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-maroon dark:text-gold">Canteen</h1>
          {theatre && (
            <p className="mt-1 flex flex-wrap items-center gap-3 font-type text-lg">
              {theatre.name}
              <Stamp tone={THEATRE_STATUS_TONES[theatre.status]} className="text-sm">
                {THEATRE_STATUS_LABELS[theatre.status]}
              </Stamp>
            </p>
          )}
        </div>
        <ButtonLink to={`/owner/theatres/${id}/food/new`}>+ Add item</ButtonLink>
      </div>

      <p className="font-type">Prices include GST. Out of stock items stay in this list, but users cannot order them.</p>

      {message && (
        <p role="status" className="font-type">
          {message}
        </p>
      )}
      {(food.isError || actionError) && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {(food.error ?? actionError).message}
        </p>
      )}
      {food.isPending && <p role="status">Loading…</p>}

      {/* UI-44 empty state */}
      {food.data?.items.length === 0 && <p className="font-type">The canteen is closed for now. Add your first item.</p>}

      {food.data?.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">Canteen items of {theatre.name}</caption>
            <thead className="font-type">
              <tr>
                {['Photo', 'Item', 'Type', 'Price', 'Stock', 'Actions'].map((h) => (
                  <th key={h} scope="col" className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {food.data.items.map((item) => (
                <tr key={item.id}>
                  <td className={cell}>
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt="" className="h-14 w-14 rounded-btn border border-ink object-cover" loading="lazy" />
                    ) : (
                      <span className="text-sm">No photo</span>
                    )}
                  </td>
                  <td className={cell}>
                    <span className="font-type font-bold">{item.name}</span>
                    {item.isCombo && (
                      <Stamp tone="green" className="ml-3 text-xs">
                        Combo
                      </Stamp>
                    )}
                  </td>
                  <td className={cell}>
                    <VegMark isVeg={item.isVeg} />
                  </td>
                  <td className={cell}>{formatRupees(item.pricePaise)}</td>
                  <td className={cell}>
                    {/* One click switches the stock; the button says what it is now */}
                    <Button
                      variant="secondary"
                      className="whitespace-nowrap"
                      aria-label={`${item.name}: ${item.inStock ? 'in stock' : 'out of stock'}. Switch`}
                      onClick={() => toggleStock(item)}
                      disabled={update.isPending}
                    >
                      {item.inStock ? '✓ In stock' : '✕ Out of stock'}
                    </Button>
                  </td>
                  <td className={cell}>
                    {confirmId === item.id ? (
                      <div className="space-y-2">
                        <p role="alert">Delete &quot;{item.name}&quot; for good?</p>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => doDelete(item)} disabled={remove.isPending}>
                            {remove.isPending ? 'Deleting…' : 'Yes, delete'}
                          </Button>
                          <Button variant="secondary" onClick={() => setConfirmId(null)}>
                            No
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <ButtonLink variant="secondary" to={`/owner/theatres/${id}/food/${item.id}`} aria-label={`Edit ${item.name}`}>
                          Edit
                        </ButtonLink>
                        <Button variant="secondary" aria-label={`Delete ${item.name}`} onClick={() => setConfirmId(item.id)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
