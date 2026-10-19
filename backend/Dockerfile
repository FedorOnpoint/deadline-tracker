FROM golang:1.26.9-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /server .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
COPY --from=build /server /usr/local/bin/server
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1
CMD ["server"]
