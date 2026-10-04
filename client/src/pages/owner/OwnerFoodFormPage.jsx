import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCreateFood, useTheatreFood, useUpdateFood } from '../../api/ownerFood.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import ImageUpload from '../../components/ui/ImageUpload.jsx'
import TextField from '../../components/ui/TextField.jsx'
import VegMark from '../../components/ui/VegMark.jsx'
import { fieldErrors } from '../../validation/auth.js'
import { EMPTY_FOOD, foodFormSchema, foodToForm, formToBody } from '../../validation/food.js'

// O-07: add a canteen item (/owner/theatres/:theatreId/food/new) or edit one
// (/owner/theatres/:theatreId/food/:foodId). The item comes from the canteen list.
export default function OwnerFoodFormPage() {
  const { theatreId, foodId } = useParams()
  const food = useTheatreFood(theatreId)
  const backLink = (
    <Link to={`/owner/theatres/${theatreId}/food`} className="underline">
      Back to the canteen
    </Link>
  )

  if (food.error) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {food.error.message} {backLink}
      </p>
    )
  }
  if (!food.data) return <p role="status">Loading…</p>
  if (!foodId) return <FoodForm key="new" theatre={food.data.theatre} />

  const item = food.data.items.find((f) => f.id === foodId)
  if (!item) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        We could not find this. {backLink}
      </p>
    )
  }
  return <FoodForm key={foodId} theatre={food.data.theatre} item={item} />
}

function FoodForm({ theatre, item }) {
  const navigate = useNavigate()
  const create = useCreateFood(theatre.id)
  const update = useUpdateFood()
  const save = item ? update : create
  const [form, setForm] = useState(item ? foodToForm(item) : EMPTY_FOOD)
  const [errors, setErrors] = useState({})

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const canteenPath = `/owner/theatres/${theatre.id}/food`

  function submit(e) {
    e.preventDefault()
    const result = foodFormSchema.safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    const body = formToBody(result.data)
    const onSuccess = () => navigate(canteenPath, { state: { message: `"${body.name}" ${item ? 'saved' : 'added'}.` } })
    // Field problems (and a name already used) go under the fields; the price field is "price" here
    const onError = (error) => {
      const { pricePaise, ...rest } = ['VALIDATION_ERROR', 'ALREADY_EXISTS'].includes(error.code) ? (error.details ?? {}) : {}
      setErrors({ ...rest, ...(pricePaise && { price: pricePaise }) })
    }
    if (item) update.mutate({ id: item.id, body }, { onSuccess, onError })
    else create.mutate(body, { onSuccess, onError })
  }

  const serverError = save.error && !['VALIDATION_ERROR', 'ALREADY_EXISTS'].includes(save.error.code) ? save.error : null

  return (
    <div className="space-y-4">
      <p>
        <Link to={canteenPath} className="font-type underline">
          ← Canteen of {theatre.name}
        </Link>
      </p>
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">{item ? `Edit ${item.name}` : 'Add canteen item'}</h1>

      <Card>
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Item name" placeholder="Butter Popcorn" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
            <TextField
              label="Price in ₹ (GST included)"
              inputMode="numeric"
              placeholder="150"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              hint="Whole rupees, ₹1 to ₹5,000."
              error={errors.price}
            />
          </div>

          <fieldset className="space-y-1" aria-describedby={errors.isVeg ? 'veg-error' : undefined}>
            <legend className="font-type">Veg or non-veg</legend>
            <div className="flex flex-wrap gap-6">
              {[
                ['veg', true],
                ['nonveg', false],
              ].map(([value, isVeg]) => (
                <label key={value} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="isVeg" value={value} checked={form.isVeg === value} onChange={() => set('isVeg', value)} className="h-5 w-5 accent-maroon" />
                  <VegMark isVeg={isVeg} />
                </label>
              ))}
            </div>
            {errors.isVeg && (
              <p id="veg-error" className="text-sm font-bold text-(--tone-alert)">
                {errors.isVeg}
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-type">More</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={form.inStock} onChange={(e) => set('inStock', e.target.checked)} className="h-5 w-5 accent-maroon" />
              In stock
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={form.isCombo} onChange={(e) => set('isCombo', e.target.checked)} className="h-5 w-5 accent-maroon" />
              Combo (e.g. popcorn + cold drink)
            </label>
          </fieldset>

          <ImageUpload label="Photo" kind="food" value={form.photoUrl} onChange={(url) => set('photoUrl', url)} error={errors.photoUrl} previewClass="h-24 w-24" optional />

          {serverError && (
            <p role="alert" className="font-bold text-(--tone-alert)">
              {serverError.message}
            </p>
          )}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
