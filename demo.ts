import { Wooter } from "@ts-rex/wooter"
import { jsonResponse, redirectResponse, fixLocation, errorResponse } from "@ts-rex/wooter/util"
import { chemin, pNumber } from "./src/export/chemin.ts" // "@ts-rex/wooter/chemin"

const db = await Deno.openKv();

type Book = {
  author: string,
  title: string
};

const wooter = new Wooter()
  .use<{ session?: { id: string, createdAt: Date } }>(async ({ request, up, resp }: { request: Request }) => {
    const sessionId = request.headers.get("Authorization")
    if (!sessionId) return resp(errorResponse(402, "Not Authorized"))
    const session = await db.get(["session", sessionId])
    if (!session.versionstamp) return resp(errorResponse(402, "Not Authorized"))
    await up({ session })
  })

wooter.GET(chemin(""), async ({ cookies, resp, }) => {
  const count = parseInt(cookies.get('count') ?? '0') + 1
  cookies.set('count', count.toString())
  resp(jsonResponse({
    hello: "world",
    count,
  }))
})

wooter.GET(chemin('redirect'), async ({ resp }) => {
  resp(redirectResponse('/book/1', {
    status: 307
  } satisfies ResponseInit))
})

wooter.route(chemin("book"))
  .GET(async ({ resp }) => {
    const books: Book[] = []
    const bookEntries = db.list<Book>({ prefix: ["books"] })
    for await (const { key, value } of bookEntries) {
      if (key[1] === "id") {
        continue
      }
      console.log(key, value)
      books.push(value)
    }
    resp(jsonResponse(books))
  })
  .POST(async ({ request, resp }) => {
    const body = await request.json();
    const idEntry = await db.get<number>(["books", "id"])
    const id = (idEntry.value ?? 0) + 1;
    const result = await db.atomic()
      .check({ key: ["books", "id"], versionstamp: idEntry.versionstamp })
      .set(["books", "id"], id)
      .set(["books", id], body)
      .commit();
    if (!result.ok) return resp(errorResponse(500, "Conflict updating the book id"))
    resp(jsonResponse(body, {
      headers: {
        location: fixLocation(request)`/book/${id}`
      }
    } satisfies ResponseInit))
  })

wooter.route(chemin("book", pNumber("id")))
  .GET(async ({ params: { id }, resp }) => {
    const maybeBook = await db.get<Book>(["books", id])
    if (!maybeBook.value) {
      return resp(errorResponse(404, "Book not found"))
    }
    resp(jsonResponse(maybeBook.value))
  })
  .PUT(async ({ params: { id }, request, resp }) => {
    const body = await request.json()
    const bookEntry = await db.get<Book>(["books", id]);
    if (!bookEntry.value) {
      return resp(errorResponse(404, "Book not found"));
    }
    const result = await db.atomic()
      .check({ key: ["books", id], versionstamp: bookEntry.versionstamp })
      .set(["books", id], body)
      .commit();
    if (!result.ok) {
      return resp(errorResponse(500, "Conflict updating the book"));
    }
    resp(jsonResponse(body));
  })
  .PATCH(async ({ params: { id }, request, resp }) => {
    const body = await request.json();
    const bookEntry = await db.get<Book>(["books", id]);
    if (!bookEntry.value) {
      return resp(errorResponse(404, "Book not found"));
    }
    const book = { ...bookEntry.value, ...body };
    const result = await db.atomic()
      .check({ key: ["books", id], versionstamp: bookEntry.versionstamp })
      .set(["books", id], book)
      .commit();
    if (!result.ok) {
      return resp(errorResponse(500, "Conflict updating the book"));
    }
    resp(jsonResponse(book))
  })
  .DELETE(async ({ params: { id }, resp }) => {
    const result = await db.delete(["books", id]);
    if (!result.ok) {
      return resp(errorResponse(500, "Conflict deleting the book"));
    }
    resp(jsonResponse({ message: "Book deleted" }));
  });


const { fetch } = wooter;
Deno.serve({ port: 3000 }, fetch)