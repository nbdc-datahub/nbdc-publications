library(shiny)
library(tidyverse)
library(openxlsx)
library(DT)
library(lubridate)
library(bslib)
library(ggtext)
library(shinyWidgets)
library(bsplus)
library(shinyjs)


# Date last updated
lastUpdated <- "2026-07-06"  


# Load the dataframe
portfolio <- readRDS(paste0("data/portfolio_forApp_", lastUpdated, ".rds"))

# Domain list
all_domains <- c(
  "Linked External Data", "MRI", "Physical Health", "NeuroCognition", "Mental Health",
  "Novel Technologies", "Friends, Family, & Community", "Substance Use", "Genetics", "COVID"
) %>% sort()

# Set consistent color
APP_BLUE <- "#2c7fb8"

# UI
ui <- fluidPage(
  
  useShinyjs(),
  
  titlePanel("Publications Using ABCD Data"),
  
  tags$head(
    tags$script(HTML("
          var lastShouldStack = null;
        
          function detectWidthAndSetLayout() {
            var screenWidth = window.innerWidth;
            var shouldStack = screenWidth < 1450;
        
            if (shouldStack !== lastShouldStack) {
              lastShouldStack = shouldStack;
              Shiny.setInputValue('stack_auto', shouldStack, {priority: 'event'});
            }
          }
        
          $(document).on('shiny:connected', function() {
            detectWidthAndSetLayout();
          });
        
          $(window).on('resize', function() {
            detectWidthAndSetLayout();
          });

    
      $(document).on('shiny:connected', function() {
        detectWidthAndSetLayout();
      });
    
      $(window).on('resize', function() {
        detectWidthAndSetLayout();
      });
    ")),
    
    tags$script(HTML("
      (function() {
        function syncSelectedCountFont() {
          var btn = document.querySelector('.btn');
          var labels = document.querySelectorAll('.selected-count');
          if (!btn || !labels.length) return;
          var size = window.getComputedStyle(btn).fontSize;
          labels.forEach(function(el){ el.style.fontSize = size; });
        }
        document.addEventListener('shiny:connected', syncSelectedCountFont);
        document.addEventListener('shiny:recalculated', syncSelectedCountFont);
        window.addEventListener('resize', syncSelectedCountFont);
      })();
    ")),
    
    
    
    tags$style(HTML("
    /* Normalize search box layout */
    div.dataTables_wrapper div.dataTables_length,
    div.dataTables_wrapper div.dataTables_filter {
      float: left !important;
      margin-right: 1.5em;
    }

    .dataTables_filter input {
      font-weight: normal !important;
    }

    /* DataTable column formatting */
    table.dataTable {
      table-layout: fixed;
      width: 100% !important;
    }

    td.year {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    td.wrap-text {
      white-space: normal;
      word-break: break-word;
    }

    td.abstract {
      text-align: center;
    }

    td.truncate-authors {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Responsive tweaks for smaller screens */
    @media (max-width: 768px) {
      td.wrap-text {
        max-width: 250px;
      }

      td.truncate-authors {
        max-width: 120px;
      }

      td.year {
        max-width: 60px;
      }
    }
  "))
  )
  ,
  
  sidebarLayout(
    sidebarPanel(
      width = 3,
      paste("Last updated", lastUpdated), # tags$em
      h4(textOutput("full_portfolio")),
      br(), 
      
      selectizeInput("domain", "Research Domain(s):",
                     choices = all_domains,
                     multiple = TRUE,
                     options = list(placeholder = 'Select one or more domains')),
      
      actionButton("clear_domains", "Clear Domain Selections",
                   style = "font-size: 90%; padding: 4px 10px;",
                   class = "btn btn-sm btn-default"),
      
      br(), br(), 
      radioButtons("matchtype", "Filter Type:",
                   choices = c("Match ANY selected domain" = "any",
                               "Match ALL selected domains" = "all"),
                   selected = "any"),
    
      br(), 
      
           checkboxGroupInput(
            "abcd_member_filter",
            "Authors include ABCD member(s)?",
            choices = c("yes", "no"),
            selected = c("yes", "no")
          ),

      br(),
      fluidRow(
        column(
          width = 8,
          sliderInput( 
            "slider", "Publication Year", 
            min = 2018, max = 2026, 
            value = c(2018, 2026),
            sep = "",
            ticks = FALSE
          )
        ),
        column(
          width = 4,
          actionButton("clear_slider", "Reset", class = "btn btn-sm btn-default", style = "margin-top: 30px;",)
        )
      ) ,
 
      br(),
      
    
      actionButton("clear_all_filters", HTML("&#x2716; Clear All Filters"), class = "btn-primary"),
      br(),
      
      br(), 
      radioButtons("filetype", "Choose file type:",
                   choices = c("CSV" = "csv", "Excel (XLSX)" = "xlsx")),
      downloadButton("downloadData", "Download Filtered Data"),
      br(), br(),
      downloadButton("downloadAllData", "Download Unfiltered Data"),
      br(), br(),
      
      # download Data Dictionary
      tags$em(paste("Export includes bibliometrics, Altmetrics, and more; see Data Documentation PDF:")),
      br(), br(),
      downloadButton(
        "dictFile",
        "Download Documentation"
      )
      
      
    ),
    
    mainPanel(
      width = 9,
      h4(textOutput("rowCount")),

      uiOutput("plotLayout"),
      
      br(),
      div(
        style = "
          border: 1px solid #ccc;
          background-color: #FFFFFF;
          border-radius: 5px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        ",
        div(
          style = "margin-bottom: 10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;",
          
          downloadButton("downloadSearch", "Download All Search Results"),
          downloadButton("downloadSelected", "Download Selected Rows"),
     
          uiOutput("selectedCountUI")   # ← sits immediately to the right of the buttons
        )
        ,
        DTOutput("filteredTable")
        
        
        )
    )
    
  )
)

# Server
server <- function(input, output, session) {
  
  
  
  # download Data Dictionary
  output$dictFile <- downloadHandler(
    filename="abcd-pubs_data-document.pdf",  # desired file name on client 
    content=function(con) {
      file.copy("abcd-pubs_data-document.pdf", con) 
    }
  )
  
  
  output$downloadAllData <- downloadHandler(
    filename = function() {
      ext <- switch(input$filetype, "csv" = ".csv", "xlsx" = ".xlsx")
      paste0("abcd-pubs_unfiltered_", lastUpdated, ext)
    },
    content = function(file) {
      if (input$filetype == "csv") {
        write.csv(portfolio, file, row.names = FALSE)
      } else {
        openxlsx::write.xlsx(portfolio, file, rowNames = FALSE)
      }
    }
  )
  
  filtered_all_columns <- reactive({
    df <- portfolio
    
    # Filter by domains if selected
    if (!is.null(input$domain) && length(input$domain) > 0) {
      df <- if (input$matchtype == "any") {
        df %>% filter(if_any(all_of(input$domain), ~ .x == 1))
      } else {
        df %>% filter(if_all(all_of(input$domain), ~ .x == 1))
      }
    }
    
    # Filter by ABCD.member if selection is made
    if (!is.null(input$abcd_member_filter) && length(input$abcd_member_filter) > 0) {
      df <- df %>% filter(ABCD.member %in% input$abcd_member_filter)
    }
    
    # Filter by Pub.Year if selection is made
    if (!is.null(input$slider) && length(input$slider) > 0) {
      df <- df %>% filter(Pub.Year >= input$slider[1] & Pub.Year <= input$slider[2])
    }
    
  df
 })
  

  filtered_data <- reactive({
    filtered_all_columns() %>%
      mutate(RowID = row_number()) %>%
      select(RowID, Year = Pub.Year, Title, Authors, Journal = Journal.Name, URL, Abstract.raw = Abstract)
  })
  
  output$rowCount <- renderText({
    n <- nrow(filtered_data())
    if (n == 0) "No matching records found." else paste("Showing", n, "publications")
  })
  

  output$domainHistogram <- renderPlot({
    df <- filtered_all_columns()
    selected_domains <- input$domain
    
    if (nrow(df) == 0) return(NULL)
    
    domain_counts <- df %>%
      select(all_of(all_domains)) %>%
      summarise(across(everything(), ~ sum(. == 1))) %>%
      pivot_longer(everything(), names_to = "Domain", values_to = "Count") %>%
      filter(Count > 0) %>%
      mutate(FilterStatus = if (length(selected_domains) == 0) {
        "Selected"
      } else {
        ifelse(Domain %in% selected_domains, "Selected", "Not Selected")
      })
    
    
    ggplot(domain_counts, aes(x = fct_reorder(Domain, Count), y = Count, fill = FilterStatus)) +
      geom_col() +
      coord_flip() +
      scale_fill_manual(values = c("Selected" = "#2c7fb8", "Not Selected" = "gray80")) +
      labs(
        title = "Publications by Research Domain",
        subtitle = "Categories are not mutually exclusive",
        x = NULL, y = "Number of Publications",
        fill = NULL
      ) +
      theme_minimal(base_size = 16) +
      ylim(0, max(domain_counts$Count) * 1.1) +   # prevent cutoff (previous: + 50)
      geom_text(aes(label = Count), hjust=-.25) +
      theme(legend.position = "right", 
            plot.title = element_text(hjust = 0.5), # element_text(face = "bold")
            plot.subtitle = element_text(size = 13, hjust = 0.5))
  })
  
  output$pubYearHistogram <- renderPlot({
    df_all <- filtered_all_columns() 
    
    if (nrow(df_all) == 0) return(NULL)
    
    # 1. Group by Year AND ABCD member status to get stacked counts
    year_counts <- df_all %>%
      count(Pub.Year, ABCD.member, name = "Count")
    
    # 2. Calculate totals per year so we can set the y-axis limit dynamically
    # and put a total number at the very top of each stacked bar
    yearly_totals <- year_counts %>%
      group_by(Pub.Year) %>%
      summarise(Total = sum(Count), .groups = "drop")
    
    max_count <- max(yearly_totals$Total)
    
    ggplot(year_counts, aes(x = factor(Pub.Year), y = Count, fill = ABCD.member)) +
      # geom_col automatically stacks when you provide a 'fill' mapped to a category
      geom_col(position = "stack") +
      
      # Label 1: The counts inside the stacked segments (middle of the block)
      geom_text(aes(label = Count), position = position_stack(vjust = 0.5), size = 4) +
      
      # Label 2: The total count at the very top of the combined bar
      geom_text(data = yearly_totals, aes(x = factor(Pub.Year), y = Total, label = Total), 
                vjust = -0.5, size = 4.5, fontface = "bold", inherit.aes = FALSE) +
      
      
      scale_fill_manual(values = c("yes" = "#2c7fb8", "no" = "gray75")) +
      
      labs(
        title = "Publications by Year",
        x = "Publication Year", 
        y = "Number of Publications",
        fill = "ABCD Member?"
      ) +
      
      # Use coord_cartesian to extend the top so the bold label isn't cut off
      coord_cartesian(ylim = c(0, max_count * 1.15)) + 
      
      theme_minimal(base_size = 16) +
      theme(
        legend.position = "right", 
        plot.title = element_text(hjust = 0.5),
        plot.subtitle = element_text(size = 13, hjust = 0.5)
      )
  })
  
  
  

  output$filteredTable <- renderDT({
    df <- filtered_data()
    if (nrow(df) == 0) return(NULL)
    
    # Add a column for checkboxes explicitly
    df <- df %>%
      mutate(
        Select = sprintf(
          '<input type="checkbox" class="row-select" value="%s">',
          htmltools::htmlEscape(URL)
        ),
        Title = mapply(function(title, url) {
          sprintf("<a href='%s' target='_blank'>%s</a>",
                  htmltools::htmlEscape(url),
                  htmltools::htmlEscape(title))
        }, Title, URL, USE.NAMES = FALSE),
        Authors = mapply(function(authors) {
          sprintf("<span title='%s'>%s</span>",
                  htmltools::htmlEscape(authors),
                  htmltools::htmlEscape(authors))
        }, Authors, USE.NAMES = FALSE),
        Abstract = paste0(
          "<button class='btn btn-sm btn-outline-primary preview-btn' id='preview_", RowID, "'>View</button>"
        )
      ) %>%
      select(Select, Year, Title, Abstract, Authors, Journal, -RowID, -URL)
    
    datatable(
      df,
      escape = FALSE,
      rownames = FALSE,
      selection = "none",   # 🚫 disable built-in DT selection
      options = list(
        deferRender = TRUE,
        pageLength = 10,
        scrollX = TRUE,
        autoWidth = FALSE,
        dom = 'plftip',
        columnDefs = list(
          list(title = "", width = '30px', targets = 0, orderable = FALSE), # no header text
          list(width = '8%',  targets = 1, className = 'year'),
          list(width = '40%', targets = 2, className = 'wrap-text'),
          list(width = '80px', targets = 3, className = 'abstract'),
          list(width = '20%', targets = 4, className = 'truncate-authors'),
          list(width = '22%', targets = 5, className = 'wrap-text')
        )
      ),
      callback = JS("
  // --- Minimal, known-good selection wiring ---
  // 'table' is the DataTables API object provided by DT (do NOT call this.api()).
  console.log('[DT] callback attached');

  var selectedIDs = [];  // stores checkbox values (your URLs)

  function reapplySelections() {
    $('input.row-select').each(function() {
      var v = $(this).val();
      $(this).prop('checked', selectedIDs.indexOf(v) !== -1);
    });
  }

  // On redraw (paging, search), reapply the checkboxes
  table.on('draw.dt', function() {
    reapplySelections();
  });

  // Checkbox change → update array + send to Shiny
  table.on('change', 'input.row-select', function() {
    var v = $(this).val();
    if (this.checked) {
      if (selectedIDs.indexOf(v) === -1) selectedIDs.push(v);
    } else {
      selectedIDs = selectedIDs.filter(function(x){ return x !== v; });
    }
    Shiny.setInputValue('selected_rows', selectedIDs, {priority:'event'});
  });

  // Row click toggles checkbox (but not on links/buttons/inputs)
  table.on('click', 'tbody tr', function(e) {
    if ($(e.target).is('a, button, input')) return;
    var $cb = $(this).find('input.row-select');
    $cb.prop('checked', !$cb.prop('checked')).trigger('change');
  });

  // Abstract preview button
  table.on('click', 'button.preview-btn', function() {
    var id = $(this).attr('id').replace('preview_', '');
    Shiny.setInputValue('abstract_preview_id', parseInt(id), {priority:'event'});
  });

  // Clear Search button 
  setTimeout(function() {
    if (!document.getElementById('clearSearchBtn')) {
      var clearBtn = $('<button>')
        .attr('id', 'clearSearchBtn')
        .addClass('btn btn-sm btn-secondary ml-2')
        .text('Clear Search')
        .click(function() { table.search('').draw(); });
      $('div.dataTables_filter').append(clearBtn);
    }
  }, 0);

  // Handle server-initiated clear of ALL selections (even off-page)
  // Must accept 1 argument, even if unused
  Shiny.addCustomMessageHandler('clearSelectionsDT', function(message) {
    // optional: console.log('[DT] clearSelectionsDT received', message);
    selectedIDs = [];
    $('input.row-select').prop('checked', false);
    Shiny.setInputValue('selected_rows', [], {priority: 'event'});
  });

")
      
    )
  }, server = FALSE)
  
  
  
  
  # Observe checkbox selections
  observe({
    selected <- input$filteredTable_rows_selected
    # We'll use JS to collect which boxes are checked
    session$sendCustomMessage("collectSelectedRows", NULL)
  })
  
  
  # live count for selected rows
  output$selectedCountUI <- renderUI({
    n <- if (is.null(input$selected_rows)) 0 else length(input$selected_rows)
    if (n == 0) return(NULL)  # hide when none selected
    
    # Count matches button font via your existing sync script; normal weight
    tags$span(
      list(
        tags$span(
          sprintf("%d row%s selected", n, if (n == 1) "" else "s"),
          class = "selected-count",
          style = "font-weight: 400; color: #495057; margin-right: 10px;"
        ),
        actionLink("clearSelectionsLink", "Clear selections",
                   class = "clear-selections-link",
                   style = paste0("font-size: inherit; color: ", APP_BLUE, ";"))
      )
    )
  })
  
  # Wire the "Clear selections" link
  observeEvent(input$clearSelectionsLink, ignoreInit = TRUE, {
    session$sendCustomMessage("clearSelectionsDT", list())
  })
  
  
  # Hide/show the Download Selected Rows button
  observe({
    has_sel <- !is.null(input$selected_rows) && length(input$selected_rows) > 0
    shinyjs::toggle(id = "downloadSelected", condition = has_sel)
  })
  
  
  
  
  # trigger modal for Abstract
  observeEvent(input$abstract_preview_id, {
    df <- filtered_data()
    row_id <- input$abstract_preview_id
    selected <- df %>% filter(RowID == row_id)
    
    showModal(modalDialog(
      title = paste("Abstract for:", selected$Title),
      HTML(sprintf("<p style='white-space: pre-wrap;'>%s</p>", htmltools::htmlEscape(selected$Abstract.raw))),
      easyClose = TRUE,
      footer = modalButton("Close")
    ))
  })
  
  
  observeEvent(input$clear_domains, {
    updateSelectizeInput(session, "domain", selected = character(0))
  })
  

  observeEvent(input$clear_slider, {
    updateSliderInput(session, "slider", value = c(2018, 2026))
  })
  

  
  observeEvent(input$clear_all_filters, {
    updateSelectizeInput(session, "domain", selected = character(0))
    updateRadioButtons(session, "matchtype", selected = "any")
    updateCheckboxGroupInput(session, "abcd_member_filter", selected = c("yes", "no"))
    updateSliderInput(session, "slider", value = c(2018, 2026))

    # Optional: Clear search box if you want it reset too
    session$sendCustomMessage("resetSearch", NULL)
  })
  
  
  output$filterStatus <- renderText({
    if (is.null(input$domain) || length(input$domain) == 0) {
      "Showing all publications"
    } else {
      paste("Filtered by:", paste(input$domain, collapse = ", "))
    }
  })
  
  
  output$downloadData <- downloadHandler(
    filename = function() {
      ext <- switch(input$filetype, "csv" = ".csv", "xlsx" = ".xlsx")
      paste0("abcd-pubs_filtered_", Sys.Date(), ext)
    },
    content = function(file) {
      data <- filtered_all_columns()
      if (input$filetype == "csv") {
        write.csv(data, file, row.names = FALSE)
      } else {
        openxlsx::write.xlsx(data, file, rowNames = FALSE)
      }
    }
  )
  
  output$downloadSearch <- downloadHandler(
    filename = function() {
      ext <- switch(input$filetype, "csv" = ".csv", "xlsx" = ".xlsx")
      paste0("abcd-pubs_search_", Sys.Date(), ext)
    },
    content = function(file) {
      # Get the filtered dataset (before search)
      df <- filtered_all_columns()
      
      # Get the rows that are visible in the DT after search
      proxy <- dataTableProxy("filteredTable")
      isolate({
        # retrieve DT state (filtered rows)
        search_rows <- input$filteredTable_rows_all
        if (!is.null(search_rows)) {
          df <- df[search_rows, ]
        }
      })
      
      # Export based on chosen filetype
      if (input$filetype == "csv") {
        write.csv(df, file, row.names = FALSE)
      } else {
        openxlsx::write.xlsx(df, file, rowNames = FALSE)
      }
    }
  )
  
  output$downloadSelected <- downloadHandler(
    filename = function() {
      ext <- switch(input$filetype, "csv" = ".csv", "xlsx" = ".xlsx")
      paste0("abcd-pubs_selected_", Sys.Date(), ext)
    },
    content = function(file) {
      # 1) Get the stable keys coming from the checkboxes (URLs as character)
      selected_urls <- input$selected_rows
      if (is.null(selected_urls) || length(selected_urls) == 0) {
        # Nothing selected -> export empty file with headers from full dataset
        empty_df <- filtered_all_columns()[0, ]
        if (input$filetype == "csv") {
          write.csv(empty_df, file, row.names = FALSE)
        } else {
          openxlsx::write.xlsx(empty_df, file, rowNames = FALSE)
        }
        return(NULL)
      }
      
      # 2) Subset the FULL (filtered) dataset by URL to get all original columns
      df_full <- filtered_all_columns()
      selected_data <- df_full %>% dplyr::filter(URL %in% selected_urls)
      
      # 3) Write output
      if (input$filetype == "csv") {
        write.csv(selected_data, file, row.names = FALSE)
      } else {
        openxlsx::write.xlsx(selected_data, file, rowNames = FALSE)
      }
    }
  )
  
  ## TEMPORARY FOR CHECK IN CONSOLE ##
  
  observe({
    if (!is.null(input$selected_rows)) {
      cat("Selected URLs (first 3):",
          paste(head(input$selected_rows, 3), collapse = " | "),
          "\n")
    }
  })
  
  
  ##
  
  
  # toggle for plots: stacked vs. side-by-side
  
  output$plotLayout <- renderUI({
    if (isTRUE(input$stack_auto)) {
      # Stacked layout
      tagList(
        div(
          class = "mb-4",
          style = "
          border: 1px solid #ccc;
          background-color: #FFFFFF;
          border-radius: 5px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        ",
          plotOutput("domainHistogram", height = "400px")
        ),
        div(
          class = "mb-4",
          style = "
          border: 1px solid #ccc;
          background-color: #FFFFFF;
          border-radius: 5px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        ",
          plotOutput("pubYearHistogram", height = "400px", width = "100%")
        )
      )
    } else {
      # Side-by-side layout
      div(
        style = "
        border: 1px solid #ccc;
        background-color: #FFFFFF;
        border-radius: 5px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
      ",
        fluidRow(
          div(
            class = "col-md-12 col-lg-7 mb-4",
            style = "padding-right: 15px;",
            plotOutput("domainHistogram", height = "400px")
          ),
          div(
            class = "col-md-12 col-lg-5 mb-4",
            div(
              style = "padding-left: 15px; padding-right: 50px",
              plotOutput("pubYearHistogram", height = "400px", width = "100%")
            )
          )
        )
      )
    }
  })
  
  
}

shinyApp(ui, server)

