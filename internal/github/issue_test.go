package github

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	gh "github.com/google/go-github/v66/github"
)

func testClient(t *testing.T, handler http.HandlerFunc) *gh.Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client := gh.NewClient(nil)
	base, err := url.Parse(server.URL + "/")
	if err != nil {
		t.Fatalf("parse base url: %v", err)
	}
	client.BaseURL = base
	return client
}

func emptyIssueList(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte("[]"))
}

// TestCreateSiteIssueCreatesNewIssue proves the happy path: no prior issue
// carries the marker, so a fresh one is created with the labels and type sent.
func TestCreateSiteIssueCreatesNewIssue(t *testing.T) {
	t.Parallel()
	var gotBody map[string]any
	client := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/repos/acme/shop/issues"):
			emptyIssueList(w)
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/repos/acme/shop/issues"):
			_ = json.NewDecoder(r.Body).Decode(&gotBody)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_, _ = fmt.Fprint(w, `{"number":7,"html_url":"https://github.com/acme/shop/issues/7",`+
				`"labels":[{"name":"bug"},{"name":"feedback/staging"}],"type":{"name":"Draft"}}`)
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	})

	report := SiteReport{Title: "Something broke", Body: "<!-- prevly-site-report:01J -->\nbody", Labels: []string{"bug", "feedback/staging"}, Type: "Draft"}
	result, err := CreateSiteIssue(context.Background(), client, "acme", "shop", "<!-- prevly-site-report:01J -->", time.Now(), report)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Number != 7 || result.URL != "https://github.com/acme/shop/issues/7" {
		t.Fatalf("result = %+v", result)
	}
	if result.Reused || result.RetriedWithoutType || len(result.MissingLabels) != 0 || result.TypeDropped {
		t.Fatalf("nothing should have been dropped: %+v", result)
	}
	if gotBody["title"] != "Something broke" || gotBody["type"] != "Draft" {
		t.Fatalf("request body = %+v", gotBody)
	}
}

// TestCreateSiteIssueReusesMarkerMatch proves a retry after an earlier timeout
// finds the issue it already created (via the strongly-consistent list, not
// search) instead of creating a duplicate.
func TestCreateSiteIssueReusesMarkerMatch(t *testing.T) {
	t.Parallel()
	const marker = "<!-- prevly-site-report:01J -->"
	var postCalls atomic.Int32
	client := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/repos/acme/shop/issues"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprintf(w, `[{"number":9,"html_url":"https://github.com/acme/shop/issues/9","body":%q}]`, marker+"\nold body")
		case r.Method == http.MethodPost:
			postCalls.Add(1)
			w.WriteHeader(http.StatusCreated)
			_, _ = fmt.Fprint(w, `{"number":10,"html_url":"https://github.com/acme/shop/issues/10"}`)
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	})

	result, err := CreateSiteIssue(context.Background(), client, "acme", "shop", marker, time.Now(), SiteReport{Title: "t", Body: marker + "\nnew body"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Reused || result.Number != 9 || result.URL != "https://github.com/acme/shop/issues/9" {
		t.Fatalf("result = %+v, want the existing issue reused", result)
	}
	if postCalls.Load() != 0 {
		t.Fatalf("must not create a duplicate issue: post called %d times", postCalls.Load())
	}
}

// TestCreateSiteIssueRetriesOnceWithoutRejectedType proves a 422 naming the
// type field is retried exactly once with the type stripped, not looped.
func TestCreateSiteIssueRetriesOnceWithoutRejectedType(t *testing.T) {
	t.Parallel()
	var postCalls atomic.Int32
	var lastType any = "unset"
	client := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet:
			emptyIssueList(w)
		case r.Method == http.MethodPost:
			n := postCalls.Add(1)
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			lastType = body["type"]
			if n == 1 {
				w.WriteHeader(http.StatusUnprocessableEntity)
				_, _ = fmt.Fprint(w, `{"message":"Invalid value for 'type'"}`)
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = fmt.Fprint(w, `{"number":1,"html_url":"https://github.com/acme/shop/issues/1"}`)
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	})

	result, err := CreateSiteIssue(context.Background(), client, "acme", "shop", "<!-- m -->", time.Now(), SiteReport{Title: "t", Body: "b", Type: "NotAType"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.RetriedWithoutType {
		t.Fatal("expected RetriedWithoutType")
	}
	if postCalls.Load() != 2 {
		t.Fatalf("post called %d times, want exactly 2 (one retry)", postCalls.Load())
	}
	if lastType != nil {
		t.Fatalf("the retry must omit the type field, got %v", lastType)
	}
}

// TestCreateSiteIssueNoRetryOnForbidden proves a 403 (no push access) is
// returned as an error, with no retry: stripping the type cannot fix it.
func TestCreateSiteIssueNoRetryOnForbidden(t *testing.T) {
	t.Parallel()
	var postCalls atomic.Int32
	client := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet:
			emptyIssueList(w)
		case r.Method == http.MethodPost:
			postCalls.Add(1)
			w.WriteHeader(http.StatusForbidden)
			_, _ = fmt.Fprint(w, `{"message":"Forbidden"}`)
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	})

	_, err := CreateSiteIssue(context.Background(), client, "acme", "shop", "<!-- m -->", time.Now(), SiteReport{Title: "t", Body: "b", Type: "Draft"})
	if err == nil {
		t.Fatal("expected an error")
	}
	if postCalls.Load() != 1 {
		t.Fatalf("post called %d times, want exactly 1 (no retry on 403)", postCalls.Load())
	}
}

// TestCreateSiteIssueReportsDroppedLabelsAndType proves the result surfaces
// what GitHub's response actually carries, so the caller can tell a silent
// drop (missing push access) from a normal success.
func TestCreateSiteIssueReportsDroppedLabelsAndType(t *testing.T) {
	t.Parallel()
	client := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet:
			emptyIssueList(w)
		case r.Method == http.MethodPost:
			w.WriteHeader(http.StatusCreated)
			// Only one of the two requested labels landed, and no type at all.
			_, _ = fmt.Fprint(w, `{"number":2,"html_url":"https://github.com/acme/shop/issues/2","labels":[{"name":"bug"}]}`)
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	})

	result, err := CreateSiteIssue(context.Background(), client, "acme", "shop", "<!-- m -->", time.Now(),
		SiteReport{Title: "t", Body: "b", Labels: []string{"bug", "feedback/staging"}, Type: "Draft"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.MissingLabels) != 1 || result.MissingLabels[0] != "feedback/staging" {
		t.Fatalf("missing labels = %+v", result.MissingLabels)
	}
	if !result.TypeDropped {
		t.Fatal("expected TypeDropped")
	}
}
