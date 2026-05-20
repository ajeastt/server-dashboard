FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ .
RUN npm run build

FROM golang:1.26-alpine AS go-builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /app
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN CGO_ENABLED=0 go build -o server-dashboard .

FROM alpine:3.21
# docker-cli, docker-compose for container management
# e2fsprogs for mkfs.ext4, parted for GPT partition tables, util-linux for lsblk/blkid/wipefs
# mergerfs (community repo) for storage pooling, fuse for FUSE support
RUN apk add --no-cache docker-cli docker-compose e2fsprogs parted util-linux fuse \
  && apk add --no-cache -X http://dl-cdn.alpinelinux.org/alpine/v3.21/community mergerfs || true
WORKDIR /app
COPY --from=go-builder /app/server-dashboard .
COPY --from=frontend-builder /app/dist ./client/dist
EXPOSE 3001
CMD ["./server-dashboard"]
